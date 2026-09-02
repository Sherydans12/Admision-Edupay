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
import {
  AppShell,
  ResponsiveSectionNav,
  StatePanel,
  type SectionNavItem,
} from "./ui-foundation";

const API_BASE =
  process.env.NEXT_PUBLIC_ADMISSION_API_URL ?? "http://localhost:3001";
const FALLBACK_TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

type Mode = "family" | "admin" | "staff";
type FamilySection =
  | "home"
  | "profile"
  | "students"
  | "offerings"
  | "applications"
  | "activities"
  | "admission"
  | "authority"
  | "form";
type AdminSection =
  | "overview"
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
  const [adminSection, setAdminSection] = useState<AdminSection>("overview");
  const [staffSection, setStaffSection] = useState<StaffSection>("dashboard");
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
    <AppShell
      header={
        <>
          <div className="topbar-brand">
            <p className="eyebrow">Admisión · postulación y seguimiento</p>
            <p className="brand">Recorrido funcional sintético</p>
          </div>
          <div className="topbar-actions">
            <div className="topbar-context">
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
            </div>
            <div aria-label="Espacio de trabajo" className="role-switcher">
              <button
                aria-pressed={mode === "family"}
                className={
                  mode === "family"
                    ? "button button-primary"
                    : "button button-quiet"
                }
                onClick={() => setMode("family")}
                type="button"
              >
                Familia
              </button>
              <button
                aria-pressed={mode === "admin"}
                className={
                  mode === "admin"
                    ? "button button-primary"
                    : "button button-quiet"
                }
                onClick={() => setMode("admin")}
                type="button"
              >
                Administración
              </button>
              <button
                aria-pressed={mode === "staff"}
                className={
                  mode === "staff"
                    ? "button button-primary"
                    : "button button-quiet"
                }
                onClick={() => setMode("staff")}
                type="button"
              >
                Atención
              </button>
            </div>
          </div>
        </>
      }
      hero={
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
                ? "Registra estudiantes, completa el formulario y revisa antes de enviar. Los documentos no se solicitan en esta etapa."
                : mode === "admin"
                  ? "Configura procesos, formularios y requisitos versionados sin hardcodear una institución piloto."
                  : "Revisa documentos o acompaña una postulación presencial con autorización trazable."}
            </p>
          </div>
          <div className="status-panel" aria-live="polite">
            <span
              aria-hidden="true"
              className={
                loading ? "status-dot status-dot-loading" : "status-dot"
              }
            />
            <span>{loading ? "Cargando" : notice}</span>
          </div>
        </section>
      }
    >
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
          onOpenAdmission={(applicationId) => {
            setActiveApplicationId(applicationId);
            setFamilySection("admission");
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
    </AppShell>
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
          aria-label={`Cerrar sesión de ${session.user.email}`}
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
  const tone = error ? "error" : loading ? "loading" : "empty";
  const title = loading
    ? "Comprobando tu sesión…"
    : error
      ? "No se pudo comprobar la sesión"
      : "Necesitas iniciar sesión";
  const actions =
    !loading && error && onRetry ? (
      <button className="button button-primary" onClick={onRetry} type="button">
        Reintentar
      </button>
    ) : !loading ? (
      <>
        <a className="button button-primary" href="/register">
          Iniciar sesión o crear acceso
        </a>
        <a className="button button-secondary" href="/register/verify">
          Ya tengo un código
        </a>
      </>
    ) : undefined;

  return (
    <StatePanel
      actions={actions}
      label={error ? "Conexión con la API" : "Acceso protegido"}
      title={title}
      tone={tone}
    >
      <p>
        {error
          ? "La API no respondió correctamente. Revisa la conexión y vuelve a intentarlo; no se ha borrado tu sesión."
          : "La cuenta se activa con un código enviado al correo. Después podrás continuar automáticamente con el portal familiar o el espacio institucional que tengas autorizado."}
      </p>
    </StatePanel>
  );
}

type FamilyNavSection = Exclude<FamilySection, "form">;

const FAMILY_NAV_ITEMS: ReadonlyArray<SectionNavItem<FamilyNavSection>> = [
  { key: "home", label: "Resumen" },
  { key: "profile", label: "Perfil familiar" },
  { key: "students", label: "Estudiantes" },
  { key: "offerings", label: "Ofertas disponibles" },
  { key: "applications", label: "Postulaciones" },
  { key: "authority", label: "Autoridad" },
  { key: "activities", label: "Seguimiento" },
  { key: "admission", label: "Oferta y resultado" },
];

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
  onOpenAdmission: (applicationId: string) => void;
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
  const submittedApplicationId =
    props.activeApplicationId ||
    props.applications.find((application) => application.status === "SUBMITTED")
      ?.id ||
    "";
  const admissionApplicationId =
    props.activeApplicationId ||
    props.applications.find((application) => application.status !== "DRAFT")
      ?.id ||
    "";
  const navigationSection: FamilyNavSection =
    familySection === "form" ? "applications" : familySection;

  return (
    <div className="content-grid">
      <ResponsiveSectionNav
        activeKey={navigationSection}
        ariaLabel="Navegación familiar"
        items={FAMILY_NAV_ITEMS}
        label="Mi espacio familiar"
        note={{
          body: "No mostramos cupos exactos, posiciones de espera ni decisiones internas.",
          title: "Privacidad visible",
        }}
        onSelect={onSectionChange}
      />
      <section className="workspace" aria-live="polite">
        {!props.familyProfile ? (
          <FamilyProfileSetup onSubmit={props.onCreateProfile} />
        ) : familySection === "home" ? (
          <FamilyHome
            applications={props.applications}
            familyProfile={props.familyProfile}
            onSectionChange={props.onSectionChange}
            students={props.students}
          />
        ) : familySection === "profile" ? (
          <FamilyProfileSection familyProfile={props.familyProfile} />
        ) : familySection === "students" ? (
          <StudentsSection {...props} />
        ) : familySection === "offerings" ? (
          <OfferingsSection {...props} />
        ) : familySection === "applications" ? (
          <ApplicationsSection {...props} />
        ) : familySection === "authority" && props.activeApplicationId ? (
          <FamilyAuthorityWorkspace
            apiBase={API_BASE}
            applicationId={props.activeApplicationId}
            key={`${props.tenantId}:${props.activeApplicationId}:authority`}
            onContinue={() => props.onSectionChange("form")}
            tenantId={props.tenantId}
          />
        ) : familySection === "authority" ? (
          <FamilyApplicationSelectionState
            description="Elige un borrador para revisar su declaración de autoridad antes de continuar con el formulario."
            onSelect={() => onSectionChange("applications")}
            title="Selecciona una postulación"
          />
        ) : familySection === "activities" && submittedApplicationId ? (
          <FamilyActivityWorkspace
            apiBase={API_BASE}
            applicationId={submittedApplicationId}
            tenantId={props.tenantId}
          />
        ) : familySection === "activities" ? (
          <FamilyApplicationSelectionState
            description="Cuando envíes una postulación, aquí podrás revisar sus actividades y próximos pasos."
            onSelect={() => onSectionChange("applications")}
            title="Aún no hay una postulación enviada"
          />
        ) : familySection === "admission" && admissionApplicationId ? (
          <FamilyAdmissionWorkspace
            apiBase={API_BASE}
            applicationId={admissionApplicationId}
            tenantId={props.tenantId}
          />
        ) : familySection === "admission" ? (
          <FamilyApplicationSelectionState
            description="El resultado y una eventual oferta estarán disponibles después del envío y la revisión institucional."
            onSelect={() => onSectionChange("applications")}
            title="No hay resultados para consultar"
          />
        ) : familySection === "form" && props.activeApplicationId ? (
          <FamilyApplicationFlow
            apiBase={API_BASE}
            applicationId={props.activeApplicationId}
            key={`${props.tenantId}:${props.activeApplicationId}`}
            onExit={() => props.onSectionChange("applications")}
            onSubmitted={props.onRefresh}
            tenantId={props.tenantId}
          />
        ) : (
          <FamilyApplicationSelectionState
            description="Vuelve a tus postulaciones y selecciona el borrador que quieres continuar."
            onSelect={() => onSectionChange("applications")}
            title="No hay un borrador activo"
          />
        )}
      </section>
    </div>
  );
}

function FamilyApplicationSelectionState({
  description,
  onSelect,
  title,
}: {
  description: string;
  onSelect: () => void;
  title: string;
}) {
  return (
    <StatePanel
      actions={
        <button
          className="button button-primary"
          onClick={onSelect}
          type="button"
        >
          Ver mis postulaciones
        </button>
      }
      label="Recorrido familiar"
      title={title}
      tone="empty"
    >
      <p>{description}</p>
    </StatePanel>
  );
}

function FamilyProfileSetup({
  onSubmit,
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="family-onboarding">
      <div className="section-heading">
        <div>
          <h2>Comienza con tu perfil familiar</h2>
          <p className="muted">
            Este primer paso habilita el recorrido de estudiantes y
            postulaciones.
          </p>
        </div>
        <span className="badge">Paso 1 de 5</span>
      </div>
      <form className="form-card form-wide" onSubmit={onSubmit}>
        <p className="auth-boundary-note">
          Usa sólo una etiqueta sintética de preproducción. No ingreses nombres
          reales.
        </p>
        <Field label="Nombre visible del perfil" name="displayName" />
        <button className="button button-primary" type="submit">
          Crear perfil y continuar
        </button>
      </form>
    </div>
  );
}

function FamilyProfileSection({
  familyProfile,
}: {
  familyProfile: FamilyProfile;
}) {
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Perfil familiar</h2>
          <p className="muted">
            Esta etiqueta identifica tu espacio sintético dentro del tenant
            actual.
          </p>
        </div>
        <span className="badge badge-open">Configurado</span>
      </div>
      <article className="profile-summary-card">
        <div>
          <span>Nombre visible</span>
          <strong>{familyProfile.displayName}</strong>
        </div>
        <p>
          La cuenta verificada y la declaración de autoridad son controles
          distintos. La autoridad se revisa por cada postulación.
        </p>
      </article>
    </>
  );
}

function FamilyHome({
  applications,
  familyProfile,
  onSectionChange,
  students,
}: {
  applications: Application[];
  familyProfile: FamilyProfile;
  onSectionChange: (section: FamilySection) => void;
  students: Student[];
}) {
  const draftCount = applications.filter(
    (application) => application.status === "DRAFT",
  ).length;
  const submittedCount = applications.filter(
    (application) => application.status === "SUBMITTED",
  ).length;
  const nextAction =
    students.length === 0
      ? {
          description:
            "Registra al menos un estudiante sintético para consultar ofertas.",
          label: "Agregar estudiante",
          section: "students" as const,
          title: "Registra un estudiante",
        }
      : applications.length === 0
        ? {
            description:
              "Selecciona una oferta publicada y crea un borrador para continuar.",
            label: "Ver ofertas disponibles",
            section: "offerings" as const,
            title: "Inicia una postulación",
          }
        : draftCount > 0
          ? {
              description:
                "Revisa la autoridad y continúa el formulario del borrador activo.",
              label: "Continuar borrador",
              section: "applications" as const,
              title: "Continúa tu borrador",
            }
          : {
              description:
                "Consulta actividades, citas y próximos pasos de tus postulaciones enviadas.",
              label: "Ver seguimiento",
              section: "activities" as const,
              title: "Revisa el seguimiento",
            };

  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Resumen familiar</h2>
          <p className="muted">Hola, {familyProfile.displayName}.</p>
        </div>
        <span className="badge badge-synthetic">Sesión activa</span>
      </div>
      <FamilyJourney
        applications={applications}
        onSectionChange={onSectionChange}
        students={students}
      />
      <div className="metric-grid">
        <Metric label="Estudiantes" value={String(students.length)} />
        <Metric label="Borradores" value={String(draftCount)} />
        <Metric label="Enviadas" value={String(submittedCount)} />
      </div>
      <div className="split-grid">
        <article className="info-card family-next-action">
          <span className="badge">Próxima acción</span>
          <h3>{nextAction.title}</h3>
          <p>{nextAction.description}</p>
          <button
            className="text-button"
            onClick={() => onSectionChange(nextAction.section)}
            type="button"
          >
            {nextAction.label}
          </button>
        </article>
        <article className="info-card info-card-accent">
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

function FamilyJourney({
  applications,
  onSectionChange,
  students,
}: {
  applications: Application[];
  onSectionChange: (section: FamilySection) => void;
  students: Student[];
}) {
  const hasApplication = applications.length > 0;
  const hasSubmittedApplication = applications.some(
    (application) => application.status === "SUBMITTED",
  );
  const steps: Array<{
    complete: boolean;
    label: string;
    section: FamilySection;
  }> = [
    { complete: true, label: "Perfil", section: "profile" },
    {
      complete: students.length > 0,
      label: "Estudiante",
      section: "students",
    },
    {
      complete: hasApplication,
      label: "Postulación",
      section: hasApplication ? "applications" : "offerings",
    },
    {
      complete: hasSubmittedApplication,
      label: "Autoridad",
      section: "authority",
    },
    {
      complete: false,
      label: "Seguimiento",
      section: "activities",
    },
  ];
  const currentIndex = Math.max(
    0,
    steps.findIndex((step) => !step.complete),
  );

  return (
    <nav aria-label="Etapas del recorrido familiar" className="family-journey">
      <ol>
        {steps.map((step, index) => {
          const current = index === currentIndex;
          const available = index <= currentIndex || step.complete;
          return (
            <li
              aria-current={current ? "step" : undefined}
              className={
                current
                  ? "journey-step journey-step-current"
                  : step.complete
                    ? "journey-step journey-step-complete"
                    : "journey-step"
              }
              key={step.label}
            >
              <button
                aria-pressed={current}
                disabled={!available}
                onClick={() => onSectionChange(step.section)}
                type="button"
              >
                <span aria-hidden="true">{index + 1}</span>
                <strong>{step.label}</strong>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
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
          <h2>Estudiantes</h2>
          <p className="muted">
            Selecciona quién postula o registra un nuevo estudiante sintético.
          </p>
        </div>
        <span className="badge">{students.length} registrados</span>
      </div>
      <div className="split-grid">
        <article className="info-card">
          <h3>Mis estudiantes</h3>
          <div className="stack-list">
            {students.length === 0 ? (
              <div className="empty-state empty-state-guided">
                <strong>Aún no hay estudiantes</strong>
                <span>
                  Completa el formulario contiguo para habilitar la consulta de
                  ofertas.
                </span>
              </div>
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
          <h2>Ofertas y disponibilidad</h2>
          <p className="muted">
            Elige un estudiante y revisa la disponibilidad pública antes de
            crear el borrador.
          </p>
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
          <div className="empty-state empty-state-guided">
            <strong>No hay ofertas publicadas</strong>
            <span>
              No necesitas realizar ninguna acción hasta que exista una oferta
              disponible para este tenant.
            </span>
          </div>
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
              {!selectedStudentId ? (
                <p
                  className="disabled-help"
                  id={`offering-help-${offering.id}`}
                >
                  Selecciona un estudiante para habilitar esta acción.
                </p>
              ) : offering.availabilityCategory === "PROCESS_CLOSED" ? (
                <p
                  className="disabled-help"
                  id={`offering-help-${offering.id}`}
                >
                  El proceso está cerrado y no admite nuevos borradores.
                </p>
              ) : null}
              <button
                aria-describedby={
                  !selectedStudentId ||
                  offering.availabilityCategory === "PROCESS_CLOSED"
                    ? `offering-help-${offering.id}`
                    : undefined
                }
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
  onOpenAdmission,
  onOpenApplication,
  onOpenActivities,
  onSectionChange,
}: {
  applications: Application[];
  onDraftSave: (
    application: Application,
    acknowledgedNoGuarantee: boolean,
  ) => void;
  onOpenAdmission: (applicationId: string) => void;
  onOpenApplication: (applicationId: string) => void;
  onOpenActivities: (applicationId: string) => void;
  onSectionChange: (section: FamilySection) => void;
}) {
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Mis postulaciones</h2>
          <p className="muted">
            Continúa borradores o consulta el seguimiento de los envíos.
          </p>
        </div>
        <span className="badge">Borradores y envíos</span>
      </div>
      <div className="stack-list">
        {applications.length === 0 ? (
          <StatePanel
            actions={
              <button
                className="button button-primary"
                onClick={() => onSectionChange("offerings")}
                type="button"
              >
                Ver ofertas disponibles
              </button>
            }
            label="Primera postulación"
            title="Todavía no hay borradores"
            tone="empty"
          >
            <p>
              Selecciona un estudiante y una oferta publicada para iniciar el
              recorrido.
            </p>
          </StatePanel>
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
                  {application.status === "SUBMITTED" ? "Enviada" : "Borrador"}
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
                    Revisar autoridad y continuar
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
                <div className="application-actions application-actions-row">
                  <button
                    className="button button-primary"
                    onClick={() => onOpenActivities(application.id)}
                    type="button"
                  >
                    Ver seguimiento
                  </button>
                  <button
                    className="button button-secondary"
                    onClick={() => onOpenAdmission(application.id)}
                    type="button"
                  >
                    Ver oferta y resultado
                  </button>
                </div>
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
  const sections: SectionNavItem<AdminSection>[] = [
    { group: "Inicio", key: "overview", label: "Resumen" },
    { group: "Estructura", key: "campus", label: "Sedes" },
    { group: "Estructura", key: "academicYear", label: "Años académicos" },
    { group: "Estructura", key: "courseLevel", label: "Cursos y niveles" },
    { group: "Estructura", key: "process", label: "Procesos" },
    { group: "Estructura", key: "offering", label: "Ofertas" },
    { group: "Diseño", key: "forms", label: "Formularios" },
    { group: "Diseño", key: "documents", label: "Documentos" },
    {
      group: "Diseño",
      key: "sensitiveProcessing",
      label: "Tratamiento sensible",
    },
    { group: "Diseño", key: "businessCalendar", label: "Calendario y plazos" },
    { group: "Diseño", key: "activities", label: "Actividades" },
    { group: "Control", key: "access", label: "Accesos" },
    { group: "Control", key: "audit", label: "Auditoría" },
    { group: "Control", key: "support", label: "Soporte global" },
  ];
  return (
    <div className="content-grid">
      <ResponsiveSectionNav
        activeKey={adminSection}
        ariaLabel="Navegación administrativa"
        items={sections}
        label="Administración"
        note={{
          body: "La UI sólo presenta acciones; permisos y tenant se verifican en la API.",
          title: "Server-side",
        }}
        onSelect={onSectionChange}
      />
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
        {adminSection === "overview" ? (
          <AdminOverview
            configuration={configuration}
            onSectionChange={onSectionChange}
          />
        ) : adminSection === "forms" ? (
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
  const sections: SectionNavItem<StaffSection>[] = [
    { group: "Inicio", key: "dashboard", label: "Resumen operativo" },
    {
      group: "Expedientes",
      key: "authority",
      label: "Autoridad de postulación",
    },
    { group: "Expedientes", key: "review", label: "Revisión documental" },
    { group: "Expedientes", key: "assistance", label: "Postulación asistida" },
    { group: "Seguimiento", key: "activities", label: "Agenda y actividades" },
    {
      group: "Seguimiento",
      key: "recommendation",
      label: "Recomendación interna",
    },
    {
      group: "Seguimiento",
      key: "direction",
      label: "Disposición de Dirección",
    },
    {
      group: "Seguimiento",
      key: "capacityOffers",
      label: "Cupos, espera y ofertas",
    },
    { group: "Control", key: "communications", label: "Comunicaciones" },
    { group: "Control", key: "reports", label: "Reportes" },
    { group: "Control", key: "audit", label: "Auditoría" },
  ];
  return (
    <div className="content-grid">
      <ResponsiveSectionNav
        activeKey={staffSection}
        ariaLabel="Navegación de atención"
        items={sections}
        label="Atención institucional"
        note={{
          body: "Se exige tenant, rol, propósito e identificador exacto. No hay búsqueda global de familias.",
          title: "Acceso mínimo",
        }}
        onSelect={onSectionChange}
      />
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

function AdminOverview({
  configuration,
  onSectionChange,
}: {
  configuration: Configuration | null;
  onSectionChange: (section: AdminSection) => void;
}) {
  const counts = [
    {
      key: "campus" as const,
      label: "Sedes",
      value: configuration?.campuses.length ?? 0,
    },
    {
      key: "academicYear" as const,
      label: "Años académicos",
      value: configuration?.academicYears.length ?? 0,
    },
    {
      key: "courseLevel" as const,
      label: "Cursos y niveles",
      value: configuration?.courseLevels.length ?? 0,
    },
    {
      key: "process" as const,
      label: "Procesos",
      value: configuration?.processes.length ?? 0,
    },
    {
      key: "offering" as const,
      label: "Ofertas",
      value: configuration?.offerings.length ?? 0,
    },
  ];
  const setupSteps = [
    {
      label: "Estructura institucional",
      detail: "Sede, año académico y curso o nivel.",
      complete:
        (configuration?.campuses.length ?? 0) > 0 &&
        (configuration?.academicYears.length ?? 0) > 0 &&
        (configuration?.courseLevels.length ?? 0) > 0,
      section: "campus" as const,
    },
    {
      label: "Proceso de admisión",
      detail: "Relaciona el proceso con un año académico.",
      complete: (configuration?.processes.length ?? 0) > 0,
      section: "process" as const,
    },
    {
      label: "Oferta y cupos",
      detail:
        "Crea la oferta como borrador y configura capacidad antes de publicar.",
      complete: (configuration?.offerings.length ?? 0) > 0,
      section: "offering" as const,
    },
  ];

  return (
    <div className="workspace-section admin-overview">
      <div className="workspace-intro">
        <div>
          <h2>Resumen de configuración</h2>
          <p>
            Organiza la estructura del tenant y avanza por etapas. Los cambios
            se validan en el servidor y quedan auditados.
          </p>
        </div>
        <span className="badge badge-synthetic">Preproducción sintética</span>
      </div>

      <section
        className="overview-summary"
        aria-labelledby="admin-summary-title"
      >
        <div className="overview-summary-heading">
          <div>
            <h3 id="admin-summary-title">Estado de la configuración</h3>
            <p className="muted">
              {configuration
                ? "Datos cargados para el tenant activo."
                : "Cargando el tenant activo…"}
            </p>
          </div>
          <span className="code">tenant aislado</span>
        </div>
        <div className="overview-counts">
          {counts.map((count) => (
            <button
              className="overview-count"
              key={count.key}
              onClick={() => onSectionChange(count.key)}
              type="button"
            >
              <strong>{count.value}</strong>
              <span>{count.label}</span>
              <span className="overview-link">Gestionar</span>
            </button>
          ))}
        </div>
      </section>

      <section className="setup-path" aria-labelledby="setup-path-title">
        <div>
          <h3 id="setup-path-title">Ruta recomendada</h3>
          <p className="muted">
            Completa la base institucional antes de trabajar con postulaciones.
          </p>
        </div>
        <ol className="setup-path-list">
          {setupSteps.map((step, index) => (
            <li
              className={
                step.complete ? "setup-step setup-step-complete" : "setup-step"
              }
              key={step.label}
            >
              <span aria-hidden="true">{step.complete ? "✓" : index + 1}</span>
              <div>
                <strong>{step.label}</strong>
                <p>{step.detail}</p>
              </div>
              <button
                className="button button-secondary"
                onClick={() => onSectionChange(step.section)}
                type="button"
              >
                {step.complete ? "Revisar" : "Configurar"}
              </button>
            </li>
          ))}
        </ol>
      </section>

      <p className="privacy-note">
        Este espacio sólo configura el tenant autorizado. No importa padrón de
        alumnos, apoderados ni datos de EduPay.
      </p>
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
    | "overview"
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
