"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AdminFormBuilder, FamilyApplicationFlow } from "./form-workflows";
import {
  FamilyAuthorityWorkspace,
  StaffAuthorityWorkspace,
} from "./authority-workflows";
import {
  AdminDocumentRequirements,
  AssistedApplicationWorkspace,
  StaffDocumentWorkspace,
} from "./document-workflows";
import {
  AdminActivityWorkspace,
  FamilyActivityWorkspace,
  StaffActivityWorkspace,
} from "./activity-workflows";
import {
  StaffDirectionWorkspace,
  StaffRecommendationWorkspace,
} from "./recommendation-workflows";
import {
  FamilyAdmissionWorkspace,
  StaffCapacityOfferWorkspace,
} from "./capacity-offer-workflows";
import {
  StaffCommunicationsWorkspace,
  StaffDashboardWorkspace,
} from "./communications-dashboard-workflows";
import {
  AdminAccessWorkspace,
  AuditWorkspace,
  PlatformSupportWorkspace,
  StaffReportsWorkspace,
} from "./reporting-admin-workflows";
import { AdminSensitiveProcessingWorkspace } from "./sensitive-processing-workflows";
import { AdminBusinessCalendarWorkspace } from "./business-calendar-workflows";

const API_BASE =
  process.env.NEXT_PUBLIC_ADMISSION_API_URL ?? "http://localhost:3001";
const FALLBACK_TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

type Mode = "family" | "admin" | "staff";
type FamilySection =
  | "home"
  | "students"
  | "offerings"
  | "applications"
  | "activities"
  | "admission"
  | "authority"
  | "form";
type AdminSection =
  | "access"
  | "audit"
  | "forms"
  | "documents"
  | "sensitiveProcessing"
  | "businessCalendar"
  | "campus"
  | "academicYear"
  | "courseLevel"
  | "process"
  | "offering"
  | "activities"
  | "support";
type StaffSection =
  | "audit"
  | "authority"
  | "dashboard"
  | "communications"
  | "review"
  | "assistance"
  | "activities"
  | "recommendation"
  | "direction"
  | "capacityOffers"
  | "reports";

interface Offering {
  academicYear: string;
  availabilityCategory: string;
  availabilityLabel: string;
  campus: string;
  code: string;
  courseLevel: string;
  id: string;
  process: string;
  title: string;
}

interface Student {
  dateOfBirth: string | null;
  familyName: string;
  givenName: string;
  id: string;
}

interface FamilyProfile {
  displayName: string;
  id: string;
  userId: string;
}

interface SessionMembership {
  permissions: string[];
  roleKeys: string[];
  tenantId: string;
  tenantName: string;
}

interface SessionSnapshot {
  authenticated: boolean;
  familyProfileId?: string | null;
  memberships?: SessionMembership[];
  session?: {
    absoluteExpiresAt: string;
    idleExpiresAt: string;
    id: string;
  };
  user?: {
    email: string;
    emailVerifiedAt: string | null;
    id: string;
  };
}

interface Application {
  createdAt: string;
  draft: { acknowledgedNoGuarantee: boolean; currentStep: string };
  id: string;
  formVersionId: string | null;
  offering: Offering;
  status: string;
  student: Student;
  submittedAt: string | null;
  updatedAt: string;
}

interface Configuration {
  academicYears: { code: string; id: string; label: string; status: string }[];
  campuses: { code: string; id: string; name: string; status: string }[];
  courseLevels: { code: string; id: string; name: string }[];
  offerings: Offering[];
  processes: {
    academicYearId: string;
    code: string;
    id: string;
    name: string;
    status: string;
  }[];
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  return (await response.json()) as T;
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("family");
  const [tenantId, setTenantId] = useState(
    process.env.NEXT_PUBLIC_ADMISSION_TENANT_ID ?? FALLBACK_TENANT,
  );
  const [familySection, setFamilySection] = useState<FamilySection>("home");
  const [adminSection, setAdminSection] = useState<AdminSection>("forms");
  const [staffSection, setStaffSection] = useState<StaffSection>("review");
  const [students, setStudents] = useState<Student[]>([]);
  const [familyProfile, setFamilyProfile] = useState<FamilyProfile | null>(
    null,
  );
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [configuration, setConfiguration] = useState<Configuration | null>(
    null,
  );
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [activeApplicationId, setActiveApplicationId] = useState("");
  const [notice, setNotice] = useState(
    "Listo para conectar con la sesión opaca de Admisión.",
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<SessionSnapshot | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [tenantPermissions, setTenantPermissions] = useState<string[]>([]);
  const [tenantPermissionsLoading, setTenantPermissionsLoading] =
    useState(false);
  const lastSessionRefreshAt = useRef(0);

  const tenantPath = useMemo(() => `/family/tenants/${tenantId}`, [tenantId]);

  const refreshSession = useCallback(async (foreground = true) => {
    const now = Date.now();
    if (!foreground && now - lastSessionRefreshAt.current < 15_000) return;
    lastSessionRefreshAt.current = now;
    if (foreground) {
      setSessionLoading(true);
      setSessionError(false);
    }
    try {
      const response = await fetch(`${API_BASE}/auth/session`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!response.ok) {
        if (response.status === 401) setSession({ authenticated: false });
        throw new Error(`HTTP_${response.status}`);
      }
      setSession((await response.json()) as SessionSnapshot);
    } catch {
      if (foreground) {
        setSession({ authenticated: false });
        setSessionError(true);
      }
    } finally {
      if (foreground) setSessionLoading(false);
    }
  }, []);

  const refreshTenantPermissions = useCallback(async () => {
    if (session?.authenticated !== true || tenantId.trim() === "") {
      setTenantPermissions([]);
      setTenantPermissionsLoading(false);
      return;
    }
    setTenantPermissionsLoading(true);
    try {
      const access = await apiFetch<{ permissions: string[] }>(
        `/staff/tenants/${tenantId}/access/me`,
      );
      setTenantPermissions(access.permissions);
    } catch {
      // Family-only or unknown tenant sessions must not learn access details.
      setTenantPermissions([]);
    } finally {
      setTenantPermissionsLoading(false);
    }
  }, [session?.authenticated, tenantId]);

  const hasPermission = useCallback(
    (permission: string) =>
      tenantPermissions.includes(permission) ||
      (session?.memberships?.some(
        (membership) =>
          membership.tenantId === tenantId &&
          membership.permissions.includes(permission),
      ) ??
        false),
    [session, tenantId, tenantPermissions],
  );

  const loadFamily = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let profile: FamilyProfile | null = null;
      try {
        profile = await apiFetch<FamilyProfile>("/family/profile");
      } catch (profileError) {
        if (
          !(profileError instanceof Error) ||
          profileError.message !== "HTTP_404"
        ) {
          throw profileError;
        }
      }
      const [studentResult, offeringResult] = await Promise.all([
        apiFetch<{ items: Student[] }>("/family/students"),
        apiFetch<{ items: Offering[] }>(`${tenantPath}/offerings`),
      ]);
      const applicationResult = profile
        ? await apiFetch<{ items: Application[] }>(`${tenantPath}/applications`)
        : { items: [] as Application[] };
      setFamilyProfile(profile);
      setStudents(studentResult.items);
      setOfferings(offeringResult.items);
      setApplications(applicationResult.items);
      setSelectedStudentId(
        (current) => current || studentResult.items[0]?.id || "",
      );
      setNotice("Datos familiares actualizados.");
    } catch {
      setError(
        "No fue posible cargar el slice. Verifica que exista una sesión activa y que el tenant sea sintético.",
      );
    } finally {
      setLoading(false);
    }
  }, [tenantPath]);

  const loadAdmin = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setConfiguration(
        await apiFetch<Configuration>(
          `/admin/tenants/${tenantId}/configuration`,
        ),
      );
      setNotice("Configuración institucional actualizada.");
    } catch {
      setError(
        "No fue posible cargar la configuración. Requiere una membresía administrativa autorizada.",
      );
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void refreshSession();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [refreshSession]);

  useEffect(() => {
    const handleFocus = () => {
      void refreshSession(false);
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refreshSession]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void refreshTenantPermissions();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [refreshTenantPermissions]);

  useEffect(() => {
    if (sessionLoading || tenantPermissionsLoading || session === null) return;
    const handle = window.setTimeout(() => {
      setError("");
      if (!session.authenticated) {
        setNotice("Inicia sesión o crea tu acceso para continuar.");
      } else if (mode === "family") {
        void loadFamily();
      } else if (mode === "admin" && !hasPermission("admission.config.read")) {
        setNotice(
          "Tu cuenta no tiene acceso a la administración de este tenant.",
        );
      } else if (
        mode === "staff" &&
        !hasPermission("application.authority.read") &&
        !hasPermission("application.read")
      ) {
        setNotice(
          "Tu cuenta no tiene acceso al espacio de atención institucional.",
        );
      } else if (mode === "admin") {
        void loadAdmin();
      } else {
        setNotice("Espacio operativo listo para un identificador exacto.");
      }
    }, 0);
    return () => window.clearTimeout(handle);
  }, [
    hasPermission,
    loadAdmin,
    loadFamily,
    mode,
    session,
    sessionLoading,
    tenantPermissionsLoading,
  ]);

  async function logout(): Promise<void> {
    setLoading(true);
    setLogoutLoading(true);
    setError("");
    try {
      let csrfToken: string | undefined;
      try {
        csrfToken = (await apiFetch<{ token: string }>("/auth/csrf")).token;
      } catch (requestError) {
        if (
          !(requestError instanceof Error) ||
          requestError.message !== "HTTP_401"
        ) {
          throw requestError;
        }
      }
      const response = await fetch(`${API_BASE}/auth/logout`, {
        credentials: "include",
        headers: csrfToken === undefined ? {} : { "X-CSRF-Token": csrfToken },
        method: "POST",
      });
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      setSession({ authenticated: false });
      setFamilyProfile(null);
      setStudents([]);
      setOfferings([]);
      setApplications([]);
      setConfiguration(null);
      setTenantPermissions([]);
      setNotice("Sesión cerrada de forma segura.");
      setMode("family");
    } catch {
      setError("No se pudo cerrar la sesión. Vuelve a intentarlo.");
    } finally {
      setLoading(false);
      setLogoutLoading(false);
    }
  }

  async function mutate<T>(
    path: string,
    method: string,
    body: unknown,
  ): Promise<T> {
    const csrf = await apiFetch<{ token: string }>("/auth/csrf");
    return apiFetch<T>(path, {
      body: JSON.stringify(body),
      headers: { "X-CSRF-Token": csrf.token },
      method,
    });
  }

  async function saveStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError("");
    try {
      await mutate("/family/students", "POST", {
        dateOfBirth: data.get("dateOfBirth"),
        familyName: data.get("familyName"),
        givenName: data.get("givenName"),
      });
      form.reset();
      await loadFamily();
      setNotice("Estudiante guardado.");
    } catch {
      setError(
        "No se pudo guardar el estudiante. La operación requiere ownership familiar y permiso explícito.",
      );
    }
  }

  async function saveFamilyProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError("");
    try {
      await mutate("/family/profile", "PUT", {
        displayName: data.get("displayName"),
      });
      form.reset();
      await loadFamily();
      setNotice("Perfil familiar sintético creado.");
    } catch {
      setError("No se pudo guardar el perfil familiar.");
    }
  }

  async function startApplication(offeringId: string) {
    if (!selectedStudentId) {
      setError("Selecciona un estudiante antes de iniciar el borrador.");
      return;
    }
    try {
      const application = await mutate<Application>(
        `${tenantPath}/applications`,
        "POST",
        {
          offeringId,
          studentId: selectedStudentId,
        },
      );
      await loadFamily();
      setActiveApplicationId(application.id);
      setFamilySection("authority");
      setNotice(
        "Borrador creado. Declara la autoridad antes de continuar al formulario.",
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error && requestError.message === "HTTP_409"
          ? "Ya existe un borrador activo para este estudiante y oferta."
          : "No se pudo iniciar el borrador.",
      );
    }
  }

  async function saveDraft(
    application: Application,
    acknowledgedNoGuarantee: boolean,
  ) {
    try {
      await mutate(
        `${tenantPath}/applications/${application.id}/draft`,
        "PATCH",
        {
          acknowledgedNoGuarantee,
          currentStep: "REVIEW",
        },
      );
      await loadFamily();
      setNotice("Borrador guardado; todavía no es una postulación enviada.");
    } catch {
      setError("No se pudo guardar el borrador.");
    }
  }

  async function saveAdminResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const section = adminSection;
    let path = "";
    let body: Record<string, FormDataEntryValue | null> = {};
    if (section === "campus") {
      path = `/admin/tenants/${tenantId}/campuses`;
      body = { code: data.get("code"), name: data.get("name") };
    } else if (section === "academicYear") {
      path = `/admin/tenants/${tenantId}/academic-years`;
      body = {
        code: data.get("code"),
        label: data.get("label"),
        status: "OPEN",
      };
    } else if (section === "courseLevel") {
      path = `/admin/tenants/${tenantId}/course-levels`;
      body = { code: data.get("code"), name: data.get("name") };
    } else if (section === "process") {
      path = `/admin/tenants/${tenantId}/processes`;
      body = {
        academicYearId: data.get("academicYearId"),
        code: data.get("code"),
        name: data.get("name"),
        status: "PUBLISHED",
      };
    } else {
      path = `/admin/tenants/${tenantId}/offerings`;
      body = {
        academicYearId: data.get("academicYearId"),
        availabilityCategory: data.get("availabilityCategory"),
        campusId: data.get("campusId"),
        code: data.get("code"),
        courseLevelId: data.get("courseLevelId"),
        processId: data.get("processId"),
        // Offerings must be created as DRAFT and published explicitly after
        // capacity is configured (R5 explicit lifecycle transition).
        status: "DRAFT",
        title: data.get("title"),
      };
    }
    try {
      await mutate(path, "POST", body);
      form.reset();
      await loadAdmin();
      setNotice("Configuración guardada y auditada.");
    } catch {
      setError(
        "No se pudo guardar la configuración. Revisa relaciones, permisos y estado del tenant.",
      );
    }
  }

  return (
    <>
      <a className="skip-link" href="#main-content">
        Saltar al contenido
      </a>
      <header className="topbar">
        <div>
          <p className="eyebrow">Admisión · E5-C / Documentos y asistencia</p>
          <p className="brand">Recorrido funcional sintético</p>
        </div>
        <div className="topbar-actions">
          <SessionControls
            busy={logoutLoading}
            loading={sessionLoading}
            onLogout={logout}
            session={session}
          />
          <label className="tenant-field">
            <span>Tenant de desarrollo</span>
            <input
              aria-label="Tenant de desarrollo"
              value={tenantId}
              onChange={(event) => {
                setTenantId(event.target.value);
                setActiveApplicationId("");
                setFamilySection("home");
                setApplications([]);
                setOfferings([]);
                setStudents([]);
                setConfiguration(null);
                setTenantPermissions([]);
              }}
            />
          </label>
          <button
            className={
              mode === "family"
                ? "button button-primary"
                : "button button-quiet"
            }
            onClick={() => setMode("family")}
          >
            Familia
          </button>
          <button
            className={
              mode === "admin" ? "button button-primary" : "button button-quiet"
            }
            onClick={() => setMode("admin")}
          >
            Administración
          </button>
          <button
            className={
              mode === "staff" ? "button button-primary" : "button button-quiet"
            }
            onClick={() => setMode("staff")}
          >
            Atención
          </button>
        </div>
      </header>

      <main id="main-content" className="shell">
        <section className="hero-card" aria-labelledby="page-title">
          <div>
            <p className="eyebrow">
              Datos sintéticos · sin producción · sin EduPay
            </p>
            <h1 id="page-title">
              {mode === "family"
                ? "Tu camino de postulación"
                : mode === "admin"
                  ? "Configuración del proceso"
                  : "Atención institucional"}
            </h1>
            <p className="lede">
              {mode === "family"
                ? "Completa el formulario, adjunta documentos y revisa antes de enviar."
                : mode === "admin"
                  ? "Configura procesos, formularios y requisitos versionados sin hardcodear una institución piloto."
                  : "Revisa documentos o acompaña una postulación presencial con autorización trazable."}
            </p>
          </div>
          <div className="status-panel" aria-live="polite">
            <span
              className={
                loading ? "status-dot status-dot-loading" : "status-dot"
              }
            />
            <span>{loading ? "Cargando" : notice}</span>
          </div>
        </section>

        {error ? (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        ) : null}

        {sessionLoading ? (
          <AuthGate loading />
        ) : sessionError ? (
          <AuthGate error onRetry={refreshSession} />
        ) : session?.authenticated !== true ? (
          <AuthGate />
        ) : mode === "family" ? (
          <FamilyView
            tenantId={tenantId}
            applications={applications}
            familyProfile={familyProfile}
            familySection={familySection}
            onCreateProfile={saveFamilyProfile}
            onCreateStudent={saveStudent}
            onDraftSave={saveDraft}
            onRefresh={loadFamily}
            activeApplicationId={activeApplicationId}
            onOpenApplication={(applicationId) => {
              setActiveApplicationId(applicationId);
              setFamilySection("authority");
            }}
            onOpenActivities={(applicationId) => {
              setActiveApplicationId(applicationId);
              setFamilySection("activities");
            }}
            onSectionChange={setFamilySection}
            onStartApplication={startApplication}
            offerings={offerings}
            selectedStudentId={selectedStudentId}
            setSelectedStudentId={setSelectedStudentId}
            students={students}
          />
        ) : mode === "admin" ? (
          <AdminView
            adminSection={adminSection}
            configuration={configuration}
            onSectionChange={setAdminSection}
            onSubmit={saveAdminResource}
            tenantId={tenantId}
          />
        ) : (
          <StaffView
            onSectionChange={setStaffSection}
            staffSection={staffSection}
            tenantId={tenantId}
          />
        )}
      </main>
    </>
  );
}

function SessionControls({
  busy,
  loading,
  onLogout,
  session,
}: {
  busy: boolean;
  loading: boolean;
  onLogout: () => Promise<void>;
  session: SessionSnapshot | null;
}) {
  if (loading) {
    return <span className="session-status">Comprobando sesión…</span>;
  }

  if (session?.authenticated === true && session.user !== undefined) {
    return (
      <div className="session-controls" aria-label="Sesión actual">
        <span className="session-status">
          <span className="session-dot" aria-hidden="true" />
          <span>
            <strong>Sesión activa</strong>
            <small>{session.user.email}</small>
          </span>
        </span>
        <button
          className="button button-quiet"
          disabled={busy}
          onClick={onLogout}
          type="button"
        >
          {busy ? "Cerrando…" : "Cerrar sesión"}
        </button>
      </div>
    );
  }

  return (
    <div className="session-controls" aria-label="Acceso a la cuenta">
      <span className="session-status">Sin sesión iniciada</span>
      <a className="button button-quiet" href="/register">
        Iniciar sesión / crear acceso
      </a>
    </div>
  );
}

function AuthGate({
  error = false,
  loading = false,
  onRetry,
}: {
  error?: boolean;
  loading?: boolean;
  onRetry?: () => Promise<void>;
}) {
  return (
    <section className="workspace auth-gate" aria-live="polite">
      <p className="eyebrow">
        {error ? "Conexión con la API" : "Acceso protegido"}
      </p>
      <h2>
        {loading
          ? "Comprobando tu sesión…"
          : error
            ? "No se pudo comprobar la sesión"
            : "Necesitas iniciar sesión"}
      </h2>
      <p>
        {error
          ? "La API no respondió correctamente. Revisa la conexión y vuelve a intentarlo; no se ha borrado tu sesión."
          : "La cuenta se activa con un código enviado al correo. Después podrás continuar automáticamente con el portal familiar o el espacio institucional que tengas autorizado."}
      </p>
      {!loading && error && onRetry ? (
        <div className="flow-actions">
          <button
            className="button button-primary"
            onClick={onRetry}
            type="button"
          >
            Reintentar
          </button>
        </div>
      ) : !loading ? (
        <div className="flow-actions">
          <a className="button button-primary" href="/register">
            Iniciar sesión o crear acceso
          </a>
          <a className="button button-secondary" href="/register/verify">
            Ya tengo un código
          </a>
        </div>
      ) : null}
    </section>
  );
}

function FamilyView(props: {
  activeApplicationId: string;
  applications: Application[];
  familyProfile: FamilyProfile | null;
  familySection: FamilySection;
  onCreateProfile: (event: FormEvent<HTMLFormElement>) => void;
  onCreateStudent: (event: FormEvent<HTMLFormElement>) => void;
  onDraftSave: (
    application: Application,
    acknowledgedNoGuarantee: boolean,
  ) => void;
  onOpenApplication: (applicationId: string) => void;
  onOpenActivities: (applicationId: string) => void;
  onRefresh: () => Promise<void>;
  onSectionChange: (section: FamilySection) => void;
  onStartApplication: (offeringId: string) => void;
  offerings: Offering[];
  selectedStudentId: string;
  setSelectedStudentId: (id: string) => void;
  students: Student[];
  tenantId: string;
}) {
  const { familySection, onSectionChange } = props;
  return (
    <div className="content-grid">
      <aside className="side-nav" aria-label="Navegación familiar">
        <p className="nav-label">Mi espacio familiar</p>
        {(
          [
            "home",
            "students",
            "offerings",
            "applications",
            "authority",
            "activities",
            "admission",
          ] as FamilySection[]
        ).map((section) => (
          <button
            className={
              familySection === section
                ? "nav-item nav-item-active"
                : "nav-item"
            }
            key={section}
            onClick={() => onSectionChange(section)}
          >
            {section === "home"
              ? "Inicio"
              : section === "students"
                ? "Estudiantes"
                : section === "offerings"
                  ? "Ofertas"
                  : section === "applications"
                    ? "Postulaciones"
                    : section === "authority"
                      ? "Autoridad"
                      : section === "activities"
                        ? "Actividades"
                        : "Resultado de admisión"}
          </button>
        ))}
        <div className="side-note">
          <strong>Privacidad visible</strong>
          <span>
            No mostramos cupos exactos, posiciones de espera ni decisiones
            internas.
          </span>
        </div>
      </aside>
      <section className="workspace" aria-live="polite">
        {!props.familyProfile ? (
          <FamilyProfileSetup onSubmit={props.onCreateProfile} />
        ) : null}
        {familySection === "home" ? <FamilyHome {...props} /> : null}
        {familySection === "students" ? <StudentsSection {...props} /> : null}
        {familySection === "offerings" ? <OfferingsSection {...props} /> : null}
        {familySection === "applications" ? (
          <ApplicationsSection {...props} />
        ) : null}
        {familySection === "authority" && props.activeApplicationId ? (
          <FamilyAuthorityWorkspace
            apiBase={API_BASE}
            applicationId={props.activeApplicationId}
            key={`${props.tenantId}:${props.activeApplicationId}:authority`}
            onContinue={() => props.onSectionChange("form")}
            tenantId={props.tenantId}
          />
        ) : null}
        {familySection === "activities" ? (
          <FamilyActivityWorkspace
            apiBase={API_BASE}
            applicationId={
              props.activeApplicationId ||
              props.applications.find(
                (application) => application.status === "SUBMITTED",
              )?.id ||
              ""
            }
            tenantId={props.tenantId}
          />
        ) : null}
        {familySection === "admission" ? (
          <FamilyAdmissionWorkspace
            apiBase={API_BASE}
            applicationId={
              props.activeApplicationId ||
              props.applications.find(
                (application) => application.status !== "DRAFT",
              )?.id ||
              ""
            }
            tenantId={props.tenantId}
          />
        ) : null}
        {familySection === "form" && props.activeApplicationId ? (
          <FamilyApplicationFlow
            apiBase={API_BASE}
            applicationId={props.activeApplicationId}
            key={`${props.tenantId}:${props.activeApplicationId}`}
            onExit={() => props.onSectionChange("applications")}
            onSubmitted={props.onRefresh}
            tenantId={props.tenantId}
          />
        ) : null}
      </section>
    </div>
  );
}

function FamilyProfileSetup({
  onSubmit,
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="form-card form-wide" onSubmit={onSubmit}>
      <p className="eyebrow">Primer acceso familiar</p>
      <h2>Configura tu perfil sintético</h2>
      <p className="form-help">
        Este nombre es solamente una etiqueta de prueba para la preproducción;
        no ingreses nombres reales.
      </p>
      <Field label="Nombre visible del perfil" name="displayName" />
      <button className="button button-primary" type="submit">
        Crear perfil familiar
      </button>
    </form>
  );
}

function FamilyHome({
  applications,
  onSectionChange,
  students,
}: {
  applications: Application[];
  onSectionChange: (section: FamilySection) => void;
  students: Student[];
}) {
  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Resumen familiar</p>
          <h2>Próxima acción clara</h2>
        </div>
        <span className="badge badge-synthetic">Sesión opaca</span>
      </div>
      <div className="metric-grid">
        <Metric label="Estudiantes" value={String(students.length)} />
        <Metric label="Borradores" value={String(applications.length)} />
        <Metric label="Integración EduPay" value="No habilitada" />
      </div>
      <div className="split-grid">
        <article className="info-card">
          <p className="eyebrow">Estado del slice</p>
          <h3>Formulario y envío habilitados</h3>
          <p>
            Registra estudiantes, consulta disponibilidad categórica, guarda
            avances y envía una postulación con su versión exacta preservada.
          </p>
          <button
            className="text-button"
            onClick={() => onSectionChange("offerings")}
          >
            Ver ofertas disponibles →
          </button>
        </article>
        <article className="info-card info-card-accent">
          <p className="eyebrow">Aviso importante</p>
          <h3>Postular no garantiza vacante</h3>
          <p>
            La disponibilidad se presenta como categoría pública: abierta, cupos
            limitados, lista de espera o proceso cerrado.
          </p>
        </article>
      </div>
    </>
  );
}

function StudentsSection({
  onCreateStudent,
  selectedStudentId,
  setSelectedStudentId,
  students,
}: {
  onCreateStudent: (event: FormEvent<HTMLFormElement>) => void;
  selectedStudentId: string;
  setSelectedStudentId: (id: string) => void;
  students: Student[];
}) {
  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Familia</p>
          <h2>Estudiantes</h2>
        </div>
        <span className="badge">{students.length} registrados</span>
      </div>
      <div className="split-grid">
        <article className="info-card">
          <h3>Mis estudiantes</h3>
          <div className="stack-list">
            {students.length === 0 ? (
              <p className="empty-state">Aún no hay estudiantes registrados.</p>
            ) : (
              students.map((student) => (
                <label className="select-row" key={student.id}>
                  <input
                    checked={selectedStudentId === student.id}
                    name="selectedStudent"
                    onChange={() => setSelectedStudentId(student.id)}
                    type="radio"
                  />
                  <span>
                    <strong>
                      {student.givenName} {student.familyName}
                    </strong>
                    <small>Identificador interno protegido</small>
                  </span>
                </label>
              ))
            )}
          </div>
        </article>
        <form className="form-card" onSubmit={onCreateStudent}>
          <h3>Agregar estudiante</h3>
          <p className="form-help">
            Sólo solicitamos los datos mínimos para identificarlo dentro de tu
            familia.
          </p>
          <Field label="Nombre" name="givenName" />
          <Field label="Apellido" name="familyName" />
          <label className="field">
            <span>Fecha de nacimiento</span>
            <input name="dateOfBirth" required type="date" />
          </label>
          <button className="button button-primary" type="submit">
            Guardar estudiante
          </button>
        </form>
      </div>
    </>
  );
}

function OfferingsSection({
  onStartApplication,
  offerings,
  selectedStudentId,
  setSelectedStudentId,
  students,
}: {
  onStartApplication: (offeringId: string) => void;
  offerings: Offering[];
  selectedStudentId: string;
  setSelectedStudentId: (id: string) => void;
  students: Student[];
}) {
  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Nueva postulación</p>
          <h2>Ofertas y disponibilidad</h2>
        </div>
        <span className="badge">Categoría pública</span>
      </div>
      <div className="toolbar">
        <label className="select-control">
          <span>Postular para</span>
          <select
            value={selectedStudentId}
            onChange={(event) => setSelectedStudentId(event.target.value)}
          >
            <option value="">Selecciona un estudiante</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.givenName} {student.familyName}
              </option>
            ))}
          </select>
        </label>
        <p className="muted">No se muestran cantidades exactas.</p>
      </div>
      <div className="cards-grid">
        {offerings.length === 0 ? (
          <p className="empty-state">
            No hay ofertas publicadas para este tenant.
          </p>
        ) : (
          offerings.map((offering) => (
            <article className="offering-card" key={offering.id}>
              <div className="offering-top">
                <span className="badge badge-open">
                  {offering.availabilityLabel}
                </span>
                <span className="code">{offering.code}</span>
              </div>
              <h3>{offering.title}</h3>
              <dl className="detail-list">
                <div>
                  <dt>Sede</dt>
                  <dd>{offering.campus}</dd>
                </div>
                <div>
                  <dt>Proceso</dt>
                  <dd>
                    {offering.process} · {offering.academicYear}
                  </dd>
                </div>
                <div>
                  <dt>Curso</dt>
                  <dd>{offering.courseLevel}</dd>
                </div>
              </dl>
              <p className="warning-copy">Postular no garantiza vacante.</p>
              <button
                className="button button-primary"
                disabled={
                  offering.availabilityCategory === "PROCESS_CLOSED" ||
                  !selectedStudentId
                }
                onClick={() => onStartApplication(offering.id)}
              >
                Iniciar borrador
              </button>
            </article>
          ))
        )}
      </div>
    </>
  );
}

function ApplicationsSection({
  applications,
  onDraftSave,
  onOpenApplication,
  onOpenActivities,
}: {
  applications: Application[];
  onDraftSave: (
    application: Application,
    acknowledgedNoGuarantee: boolean,
  ) => void;
  onOpenApplication: (applicationId: string) => void;
  onOpenActivities: (applicationId: string) => void;
}) {
  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Seguimiento</p>
          <h2>Mis postulaciones</h2>
        </div>
        <span className="badge">Borradores y envíos</span>
      </div>
      <div className="stack-list">
        {applications.length === 0 ? (
          <p className="empty-state">Todavía no hay borradores.</p>
        ) : (
          applications.map((application) => (
            <article className="application-card" key={application.id}>
              <div>
                <span
                  className={
                    application.status === "SUBMITTED"
                      ? "badge badge-open"
                      : "badge badge-draft"
                  }
                >
                  {application.status}
                </span>
                <h3>
                  {application.student.givenName}{" "}
                  {application.student.familyName} ·{" "}
                  {application.offering.title}
                </h3>
                <p className="muted">
                  {application.status === "SUBMITTED"
                    ? `Enviada${application.submittedAt ? ` · ${new Date(application.submittedAt).toLocaleDateString("es-CL")}` : ""}`
                    : `Formulario v${application.formVersionId ? " fijado" : " histórico"}`}
                </p>
              </div>
              {application.status === "DRAFT" && application.formVersionId ? (
                <div className="application-actions">
                  <button
                    className="button button-primary"
                    onClick={() => onOpenApplication(application.id)}
                    type="button"
                  >
                    Continuar formulario
                  </button>
                  <label className="checkbox-row">
                    <input
                      checked={application.draft.acknowledgedNoGuarantee}
                      onChange={(event) =>
                        onDraftSave(application, event.target.checked)
                      }
                      type="checkbox"
                    />
                    <span>Entiendo que postular no garantiza vacante</span>
                  </label>
                </div>
              ) : null}
              {application.status === "SUBMITTED" ? (
                <button
                  className="button button-secondary"
                  onClick={() => onOpenActivities(application.id)}
                  type="button"
                >
                  Ver actividades y citas
                </button>
              ) : null}
              {application.status === "DRAFT" && !application.formVersionId ? (
                <span className="muted">
                  Borrador histórico legible; no admite envío versionado.
                </span>
              ) : null}
            </article>
          ))
        )}
      </div>
    </>
  );
}

function AdminView({
  adminSection,
  configuration,
  onSectionChange,
  onSubmit,
  tenantId,
}: {
  adminSection: AdminSection;
  configuration: Configuration | null;
  onSectionChange: (section: AdminSection) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  tenantId: string;
}) {
  const sections: { key: AdminSection; label: string }[] = [
    { key: "access", label: "Accesos" },
    { key: "audit", label: "Auditoría" },
    { key: "forms", label: "Formularios" },
    { key: "documents", label: "Documentos" },
    { key: "sensitiveProcessing", label: "Tratamiento sensible" },
    { key: "businessCalendar", label: "Calendario y plazos" },
    { key: "activities", label: "Actividades" },
    { key: "campus", label: "Sede" },
    { key: "academicYear", label: "Año" },
    { key: "courseLevel", label: "Curso" },
    { key: "process", label: "Proceso" },
    { key: "offering", label: "Oferta" },
    { key: "support", label: "Soporte global" },
  ];
  return (
    <div className="content-grid">
      <aside className="side-nav" aria-label="Navegación administrativa">
        <p className="nav-label">Administración</p>
        {sections.map((section) => (
          <button
            className={
              adminSection === section.key
                ? "nav-item nav-item-active"
                : "nav-item"
            }
            key={section.key}
            onClick={() => onSectionChange(section.key)}
          >
            {section.label}
          </button>
        ))}
        <div className="side-note">
          <strong>Server-side</strong>
          <span>
            La UI sólo presenta acciones; permisos y tenant se verifican en la
            API.
          </span>
        </div>
      </aside>
      <section className="workspace">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Administrador autorizado</p>
            <h2>
              {sections.find((section) => section.key === adminSection)?.label}
            </h2>
          </div>
          <span className="badge badge-synthetic">Auditado</span>
        </div>
        {adminSection === "forms" ? (
          <AdminFormBuilder
            apiBase={API_BASE}
            key={tenantId}
            offerings={configuration?.offerings ?? []}
            tenantId={tenantId}
          />
        ) : adminSection === "documents" ? (
          <AdminDocumentRequirements apiBase={API_BASE} tenantId={tenantId} />
        ) : adminSection === "sensitiveProcessing" ? (
          <AdminSensitiveProcessingWorkspace
            apiBase={API_BASE}
            tenantId={tenantId}
          />
        ) : adminSection === "businessCalendar" ? (
          <AdminBusinessCalendarWorkspace
            apiBase={API_BASE}
            tenantId={tenantId}
          />
        ) : adminSection === "activities" ? (
          <AdminActivityWorkspace apiBase={API_BASE} tenantId={tenantId} />
        ) : adminSection === "access" ? (
          <AdminAccessWorkspace apiBase={API_BASE} tenantId={tenantId} />
        ) : adminSection === "audit" ? (
          <AuditWorkspace apiBase={API_BASE} tenantId={tenantId} />
        ) : adminSection === "support" ? (
          <PlatformSupportWorkspace apiBase={API_BASE} tenantId={tenantId} />
        ) : (
          <AdminForm
            adminSection={adminSection}
            configuration={configuration}
            onSubmit={onSubmit}
          />
        )}
      </section>
    </div>
  );
}

function StaffView({
  onSectionChange,
  staffSection,
  tenantId,
}: {
  onSectionChange: (section: StaffSection) => void;
  staffSection: StaffSection;
  tenantId: string;
}) {
  const sections: { key: StaffSection; label: string }[] = [
    { key: "dashboard", label: "Dashboard operativo" },
    { key: "authority", label: "Autoridad de postulación" },
    { key: "communications", label: "Comunicaciones" },
    { key: "review", label: "Revisión documental" },
    { key: "assistance", label: "Postulación asistida" },
    { key: "activities", label: "Agenda y actividades" },
    { key: "recommendation", label: "Recomendación interna" },
    { key: "direction", label: "Disposición de Dirección" },
    { key: "capacityOffers", label: "Cupos, espera y ofertas" },
    { key: "reports", label: "Reportes" },
    { key: "audit", label: "Auditoría" },
  ];
  return (
    <div className="content-grid">
      <aside className="side-nav" aria-label="Navegación de atención">
        <p className="nav-label">Atención institucional</p>
        {sections.map((section) => (
          <button
            className={
              staffSection === section.key
                ? "nav-item nav-item-active"
                : "nav-item"
            }
            key={section.key}
            onClick={() => onSectionChange(section.key)}
          >
            {section.label}
          </button>
        ))}
        <div className="side-note">
          <strong>Acceso mínimo</strong>
          <span>
            Se exige tenant, rol, propósito e identificador exacto. No hay
            búsqueda global de familias.
          </span>
        </div>
      </aside>
      <section className="workspace">
        <div className="section-heading">
          <div>
            <h2>
              {sections.find((section) => section.key === staffSection)?.label}
            </h2>
            <p className="muted">
              Las decisiones y acciones quedan vinculadas al operador efectivo.
            </p>
          </div>
          <span className="badge badge-synthetic">Auditado</span>
        </div>
        {staffSection === "dashboard" ? (
          <StaffDashboardWorkspace apiBase={API_BASE} tenantId={tenantId} />
        ) : staffSection === "authority" ? (
          <StaffAuthorityWorkspace apiBase={API_BASE} tenantId={tenantId} />
        ) : staffSection === "communications" ? (
          <StaffCommunicationsWorkspace
            apiBase={API_BASE}
            applicationId=""
            tenantId={tenantId}
          />
        ) : staffSection === "review" ? (
          <StaffDocumentWorkspace apiBase={API_BASE} tenantId={tenantId} />
        ) : staffSection === "assistance" ? (
          <AssistedApplicationWorkspace
            apiBase={API_BASE}
            tenantId={tenantId}
          />
        ) : staffSection === "activities" ? (
          <StaffActivityWorkspace apiBase={API_BASE} tenantId={tenantId} />
        ) : staffSection === "recommendation" ? (
          <StaffRecommendationWorkspace
            apiBase={API_BASE}
            tenantId={tenantId}
          />
        ) : staffSection === "capacityOffers" ? (
          <StaffCapacityOfferWorkspace apiBase={API_BASE} tenantId={tenantId} />
        ) : staffSection === "reports" ? (
          <StaffReportsWorkspace apiBase={API_BASE} tenantId={tenantId} />
        ) : staffSection === "audit" ? (
          <AuditWorkspace apiBase={API_BASE} tenantId={tenantId} />
        ) : (
          <StaffDirectionWorkspace apiBase={API_BASE} tenantId={tenantId} />
        )}
      </section>
    </div>
  );
}

function AdminForm({
  adminSection,
  configuration,
  onSubmit,
}: {
  adminSection: Exclude<
    AdminSection,
    | "access"
    | "audit"
    | "forms"
    | "documents"
    | "sensitiveProcessing"
    | "businessCalendar"
    | "activities"
    | "support"
  >;
  configuration: Configuration | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (adminSection === "campus")
    return (
      <form className="form-card form-wide" onSubmit={onSubmit}>
        <h3>Crear sede</h3>
        <Field label="Código" name="code" />
        <Field label="Nombre" name="name" />
        <button className="button button-primary" type="submit">
          Guardar sede
        </button>
        <ExistingList
          items={
            configuration?.campuses.map(
              (item) => `${item.code} · ${item.name}`,
            ) ?? []
          }
        />
      </form>
    );
  if (adminSection === "academicYear")
    return (
      <form className="form-card form-wide" onSubmit={onSubmit}>
        <h3>Crear año académico</h3>
        <Field label="Código" name="code" placeholder="YEAR-SYNTH" />
        <Field
          label="Etiqueta visible"
          name="label"
          placeholder="Año sintético"
        />
        <button className="button button-primary" type="submit">
          Guardar año
        </button>
        <ExistingList
          items={
            configuration?.academicYears.map(
              (item) => `${item.code} · ${item.label}`,
            ) ?? []
          }
        />
      </form>
    );
  if (adminSection === "courseLevel")
    return (
      <form className="form-card form-wide" onSubmit={onSubmit}>
        <h3>Crear curso o nivel</h3>
        <Field label="Código" name="code" />
        <Field label="Nombre" name="name" />
        <button className="button button-primary" type="submit">
          Guardar curso
        </button>
        <ExistingList
          items={
            configuration?.courseLevels.map(
              (item) => `${item.code} · ${item.name}`,
            ) ?? []
          }
        />
      </form>
    );
  if (adminSection === "process")
    return (
      <form className="form-card form-wide" onSubmit={onSubmit}>
        <h3>Crear proceso</h3>
        <SelectField
          label="Año académico"
          name="academicYearId"
          options={
            configuration?.academicYears.map((item) => ({
              label: item.label,
              value: item.id,
            })) ?? []
          }
        />
        <Field label="Código" name="code" />
        <Field label="Nombre" name="name" />
        <button className="button button-primary" type="submit">
          Publicar proceso
        </button>
        <ExistingList
          items={
            configuration?.processes.map(
              (item) => `${item.code} · ${item.name}`,
            ) ?? []
          }
        />
      </form>
    );
  return (
    <form className="form-card form-wide" onSubmit={onSubmit}>
      <h3>Crear oferta</h3>
      <SelectField
        label="Sede"
        name="campusId"
        options={
          configuration?.campuses.map((item) => ({
            label: item.name,
            value: item.id,
          })) ?? []
        }
      />
      <SelectField
        label="Año académico"
        name="academicYearId"
        options={
          configuration?.academicYears.map((item) => ({
            label: item.label,
            value: item.id,
          })) ?? []
        }
      />
      <SelectField
        label="Proceso"
        name="processId"
        options={
          configuration?.processes.map((item) => ({
            label: item.name,
            value: item.id,
          })) ?? []
        }
      />
      <SelectField
        label="Curso"
        name="courseLevelId"
        options={
          configuration?.courseLevels.map((item) => ({
            label: item.name,
            value: item.id,
          })) ?? []
        }
      />
      <Field label="Código" name="code" />
      <Field label="Título" name="title" />
      <SelectField
        label="Disponibilidad categórica"
        name="availabilityCategory"
        options={[
          { label: "Postulaciones abiertas", value: "POSTULATIONS_OPEN" },
          { label: "Cupos limitados", value: "LIMITED_CAPACITY" },
          { label: "Lista de espera", value: "WAITLIST" },
          { label: "Proceso cerrado", value: "PROCESS_CLOSED" },
        ]}
      />
      <button className="button button-primary" type="submit">
        Publicar oferta
      </button>
      <ExistingList
        items={
          configuration?.offerings.map(
            (item) => `${item.code} · ${item.title}`,
          ) ?? []
        }
      />
    </form>
  );
}

function ExistingList({ items }: { items: string[] }) {
  return (
    <div className="existing-list">
      <p className="form-help">Configuración existente</p>
      {items.length === 0 ? (
        <span className="muted">Sin registros</span>
      ) : (
        items.map((item) => <span key={item}>{item}</span>)
      )}
    </div>
  );
}
function Field({
  label,
  name,
  placeholder,
}: {
  label: string;
  name: string;
  placeholder?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input name={name} placeholder={placeholder} required />
    </label>
  );
}
function SelectField({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: { label: string; value: string }[];
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select name={name} required>
        <option value="">Seleccionar</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
