"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type SubjectMode = "MINOR_REPRESENTATIVE" | "ADULT_STUDENT_SELF";
type AuthorityStatus =
  | "NOT_DECLARED"
  | "DECLARED"
  | "EVIDENCE_PENDING"
  | "UNDER_REVIEW"
  | "VERIFIED"
  | "DISPUTED"
  | "REJECTED";

interface AuthorityDto {
  applicationId: string;
  authorityBasis: string | null;
  concurrencyVersion: number | null;
  declaredAt: string | null;
  relationship: string | null;
  status: AuthorityStatus;
  studentAgeCategory: "ADULT" | "MINOR" | "UNKNOWN";
  subjectMode: SubjectMode | null;
  verifiedAt: string | null;
}

interface StaffAuthorityDto extends AuthorityDto {
  authorityUserId: string | null;
  canReview: boolean;
  evidence: { documentVersionId: string; linkedAt: string }[];
  history: {
    actorUserId: string;
    createdAt: string;
    fromStatus: AuthorityStatus;
    reason: string | null;
    sequenceNumber: number;
    toStatus: AuthorityStatus;
  }[];
}

class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
  ) {
    super(code === undefined ? `HTTP_${status}` : `HTTP_${status}_${code}`);
    this.name = "ApiError";
  }
}

const statusCopy: Record<AuthorityStatus, string> = {
  NOT_DECLARED: "Pendiente de declaración",
  DECLARED: "Declaración recibida",
  EVIDENCE_PENDING: "Se requiere evidencia adicional",
  UNDER_REVIEW: "En revisión institucional",
  VERIFIED: "Autoridad verificada",
  DISPUTED: "Autoridad en revisión especial",
  REJECTED: "Declaración no verificada",
};

async function request<T>(
  apiBase: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    credentials: "include",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    let code: string | undefined;
    try {
      const payload = (await response.json()) as { code?: unknown };
      if (typeof payload.code === "string") code = payload.code;
    } catch {
      // Preserve the HTTP status when the error response has no JSON body.
    }
    throw new ApiError(response.status, code);
  }
  return (await response.json()) as T;
}

function reviewOptions(status: AuthorityStatus): {
  label: string;
  value: Extract<
    AuthorityStatus,
    "EVIDENCE_PENDING" | "UNDER_REVIEW" | "VERIFIED" | "DISPUTED" | "REJECTED"
  >;
}[] {
  switch (status) {
    case "DECLARED":
      return [{ label: "Iniciar revisión", value: "UNDER_REVIEW" }];
    case "EVIDENCE_PENDING":
      return [{ label: "Reanudar revisión", value: "UNDER_REVIEW" }];
    case "UNDER_REVIEW":
      return [
        { label: "Verificar", value: "VERIFIED" },
        { label: "Solicitar evidencia", value: "EVIDENCE_PENDING" },
        { label: "Marcar disputa", value: "DISPUTED" },
        { label: "Rechazar declaración", value: "REJECTED" },
      ];
    case "DISPUTED":
      return [
        { label: "Reanudar revisión", value: "UNDER_REVIEW" },
        { label: "Verificar", value: "VERIFIED" },
        { label: "Rechazar declaración", value: "REJECTED" },
      ];
    case "VERIFIED":
      return [{ label: "Marcar disputa", value: "DISPUTED" }];
    default:
      return [];
  }
}

async function mutate<T>(
  apiBase: string,
  path: string,
  body: unknown,
): Promise<T> {
  const csrf = await request<{ token: string }>(apiBase, "/auth/csrf");
  return request<T>(apiBase, path, {
    body: JSON.stringify(body),
    headers: { "X-CSRF-Token": csrf.token },
    method: "POST",
  });
}

export function FamilyAuthorityWorkspace({
  apiBase,
  applicationId,
  onContinue,
  tenantId,
}: {
  apiBase: string;
  applicationId: string;
  onContinue: () => void;
  tenantId: string;
}) {
  const [authority, setAuthority] = useState<AuthorityDto | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const path = `/family/tenants/${tenantId}/applications/${applicationId}/authority`;

  const load = useCallback(async () => {
    if (!applicationId) return;
    try {
      setAuthority(await request<AuthorityDto>(apiBase, path));
    } catch {
      setError("No fue posible consultar la declaración de autoridad.");
    }
  }, [apiBase, applicationId, path]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const subjectMode = data.get("subjectMode") as SubjectMode;
    setSaving(true);
    setError("");
    try {
      const result = await mutate<AuthorityDto>(apiBase, path, {
        authorityBasis: data.get("authorityBasis"),
        ...(authority?.concurrencyVersion === null || authority === null
          ? {}
          : { expectedConcurrencyVersion: authority.concurrencyVersion }),
        relationship: data.get("relationship"),
        subjectMode,
      });
      setAuthority(result);
    } catch {
      setError(
        "No se pudo registrar la declaración. Revisa la fecha de nacimiento y la combinación declarada.",
      );
    } finally {
      setSaving(false);
    }
  }

  const isAdult = authority?.studentAgeCategory === "ADULT";
  const isUnknown = authority?.studentAgeCategory === "UNKNOWN";
  return (
    <section className="workspace-stack" aria-labelledby="authority-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Autoridad antes del envío</p>
          <h2 id="authority-title">Declaración de autoridad</h2>
        </div>
        <span className="badge badge-synthetic">
          {authority ? statusCopy[authority.status] : "Cargando"}
        </span>
      </div>
      <p className="muted">
        La verificación de tu cuenta es distinta de la declaración y revisión de
        autoridad. No compartimos la fecha de nacimiento con las ofertas
        públicas.
      </p>
      {isUnknown ? (
        <p className="alert alert-error">
          Antes de declarar, completa una fecha de nacimiento válida del
          estudiante en tu perfil familiar.
        </p>
      ) : (
        <form className="form-card form-wide" onSubmit={submit}>
          <label className="field">
            <span>Sujeto de autoridad</span>
            <select
              defaultValue={
                isAdult ? "ADULT_STUDENT_SELF" : "MINOR_REPRESENTATIVE"
              }
              disabled={isAdult}
              name={isAdult ? undefined : "subjectMode"}
            >
              {isAdult ? (
                <option value="ADULT_STUDENT_SELF">
                  Estudiante adulto: declaración propia
                </option>
              ) : (
                <option value="MINOR_REPRESENTATIVE">
                  Representante de estudiante menor
                </option>
              )}
            </select>
          </label>
          {isAdult ? (
            <>
              <input name="relationship" type="hidden" value="SELF" />
              <input name="authorityBasis" type="hidden" value="SELF" />
              <input
                name="subjectMode"
                type="hidden"
                value="ADULT_STUDENT_SELF"
              />
              <p className="form-help">
                Como estudiante adulto, debes declarar expresamente tu propia
                autoridad. Un contacto responsable no sustituye esta
                declaración.
              </p>
            </>
          ) : (
            <>
              <label className="field">
                <span>Relación con el estudiante</span>
                <select
                  defaultValue={authority?.relationship ?? "MOTHER"}
                  name="relationship"
                >
                  <option value="MOTHER">Madre</option>
                  <option value="FATHER">Padre</option>
                  <option value="OTHER_RELATIVE">Otro familiar</option>
                  <option value="OTHER">Otra relación</option>
                </select>
              </label>
              <label className="field">
                <span>Base declarada</span>
                <select
                  defaultValue={authority?.authorityBasis ?? "PARENT"}
                  name="authorityBasis"
                >
                  <option value="PARENT">Madre, padre o progenitor</option>
                  <option value="LEGAL_REPRESENTATIVE">
                    Representación legal
                  </option>
                  <option value="PERSONAL_CARE_HOLDER">Cuidado personal</option>
                  <option value="AUTHORIZED_BY_AUTHORITY_HOLDER">
                    Autorización del titular
                  </option>
                </select>
              </label>
            </>
          )}
          <button
            className="button button-primary"
            disabled={saving}
            type="submit"
          >
            {authority?.status === "VERIFIED"
              ? "Volver a declarar"
              : "Registrar declaración"}
          </button>
        </form>
      )}
      {authority?.status === "DECLARED" ||
      authority?.status === "UNDER_REVIEW" ? (
        <p className="alert alert-warning">
          La declaración quedó registrada. Puedes completar el formulario, pero
          la autoridad deberá ser verificada antes del envío final.
        </p>
      ) : authority?.status === "VERIFIED" ? (
        <p className="alert alert-success">
          La autoridad fue verificada. Ya puedes completar y enviar la
          postulación.
        </p>
      ) : authority?.status ? (
        <p className="alert alert-error">
          No podrás enviar la postulación ni aceptar una oferta hasta que la
          autoridad sea verificada.
        </p>
      ) : null}
      {authority?.status === "DECLARED" ||
      authority?.status === "UNDER_REVIEW" ||
      authority?.status === "VERIFIED" ? (
        <button
          className="button button-primary"
          onClick={onContinue}
          type="button"
        >
          {authority.status === "VERIFIED"
            ? "Continuar al formulario"
            : "Continuar con el formulario"}
        </button>
      ) : null}
      {error ? (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

export function StaffAuthorityWorkspace({
  apiBase,
  tenantId,
}: {
  apiBase: string;
  tenantId: string;
}) {
  const [applicationId, setApplicationId] = useState("");
  const [authority, setAuthority] = useState<StaffAuthorityDto | null>(null);
  const [error, setError] = useState("");
  async function load(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setError("");
      setAuthority(
        await request<StaffAuthorityDto>(
          apiBase,
          `/staff/tenants/${tenantId}/applications/${applicationId}/authority`,
        ),
      );
    } catch {
      setError(
        "No fue posible consultar la autoridad. Se requiere la capacidad correspondiente y un identificador exacto.",
      );
    }
  }
  async function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authority) return;
    const data = new FormData(event.currentTarget);
    try {
      const evidence = String(data.get("evidenceDocumentVersionIds") ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      setAuthority(
        await mutate<StaffAuthorityDto>(
          apiBase,
          `/staff/tenants/${tenantId}/applications/${applicationId}/authority/review`,
          {
            evidenceDocumentVersionIds: evidence,
            expectedConcurrencyVersion: authority.concurrencyVersion,
            reason: data.get("reason"),
            toStatus: data.get("toStatus"),
          },
        ),
      );
    } catch (requestError) {
      setError(
        requestError instanceof ApiError &&
          requestError.code === "AUTHORITY_INVALID_TRANSITION"
          ? "La transición no corresponde al estado actual. Desde una declaración recibida debes iniciar la revisión antes de verificarla."
          : "La transición fue rechazada. Una revisión requiere motivo, versión vigente y evidencia válida cuando aplique.",
      );
    }
  }
  const options = authority ? reviewOptions(authority.status) : [];
  return (
    <section className="workspace-stack">
      <form className="toolbar" onSubmit={load}>
        <label className="field">
          <span>ID de postulación</span>
          <input
            onChange={(event) => setApplicationId(event.target.value)}
            required
            value={applicationId}
          />
        </label>
        <button className="button button-secondary" type="submit">
          Consultar autoridad
        </button>
      </form>
      {authority ? (
        <>
          <article className="form-card">
            <h3>{statusCopy[authority.status]}</h3>
            <p className="muted">
              Modo: {authority.subjectMode ?? "sin declaración"} · Relación:{" "}
              {authority.relationship ?? "—"} · Base:{" "}
              {authority.authorityBasis ?? "—"}
            </p>
          </article>
          {authority.canReview && options.length > 0 ? (
            <form className="form-card" onSubmit={review}>
              <h3>Revisión autorizada</h3>
              <label className="field" key={authority.status}>
                <span>Transición</span>
                <select name="toStatus">
                  {options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Motivo o fundamento</span>
                <textarea name="reason" required />
              </label>
              <label className="field">
                <span>
                  Versiones de evidencia (IDs separados por coma, opcional)
                </span>
                <input name="evidenceDocumentVersionIds" />
              </label>
              <button className="button button-primary" type="submit">
                Registrar revisión
              </button>
            </form>
          ) : authority.canReview ? (
            <p className="muted">
              Esta declaración no tiene transiciones adicionales disponibles.
            </p>
          ) : (
            <p className="muted">
              Tu capacidad permite lectura, pero no revisión de autoridad.
            </p>
          )}
          <article className="form-card">
            <h3>Historial</h3>
            {authority.history.map((item) => (
              <p key={item.sequenceNumber} className="muted">
                {item.sequenceNumber}. {item.fromStatus} → {item.toStatus} ·{" "}
                {new Date(item.createdAt).toLocaleString("es-CL")}
              </p>
            ))}
          </article>
        </>
      ) : null}
      {error ? <p className="alert alert-error">{error}</p> : null}
    </section>
  );
}
