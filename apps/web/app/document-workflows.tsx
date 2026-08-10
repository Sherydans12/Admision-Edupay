"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type AnswerValue = boolean | string;

interface RequirementVersion {
  allowedFileTypes: Array<"PDF" | "JPEG" | "PNG">;
  allowsEquivalent: boolean;
  correctionWindowBusinessDays: number;
  equivalentOptions: { code: string; label: string }[];
  id: string;
  instruction: string | null;
  lifecycle: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  maxAgeDays: number | null;
  maxFileSizeBytes: number;
  required: boolean;
  sensitivity: "internal" | "restricted" | "highly_restricted";
  validityRule: "NONE" | "LATEST_AVAILABLE" | "MAX_AGE_DAYS";
  versionNumber: number;
}

interface DocumentSubmission {
  applicable: boolean;
  correctionDueAt: string | null;
  correctionOverdue: boolean;
  currentDocumentVersion: {
    detectedMime: string | null;
    documentIssuedOn: string | null;
    equivalentOptionCode: string | null;
    id: string;
    origin: "FAMILY" | "ASSISTED" | "PHYSICAL_DOCUMENT";
    sizeBytes: number;
    technicalStatus: string;
    versionNumber: number;
  } | null;
  history: {
    createdAt: string;
    id: string;
    origin: string;
    projectedStatus: string;
    technicalStatus: string;
    versionNumber: number;
  }[];
  id: string;
  requirement: {
    code: string;
    id: string;
    name: string;
    purpose: string;
    version: RequirementVersion;
  };
  reviews: {
    correctionDueAt: string | null;
    createdAt: string;
    id: string;
    reason: string | null;
    verdict: string;
  }[];
  status: string;
}

interface DocumentList {
  applicationId: string;
  items: DocumentSubmission[];
  pinnedAt: string;
}

interface FormField {
  condition: {
    fieldId: string;
    operator: "EQUALS" | "NOT_EQUALS" | "IN";
    value: AnswerValue | AnswerValue[];
  } | null;
  helpText: string | null;
  id: string;
  label: string;
  options: { label: string; value: string }[];
  required: boolean;
  type: "TEXT" | "TEXTAREA" | "SELECT" | "RADIO" | "BOOLEAN" | "DATE";
}

interface AssistedWorkflow {
  documents: DocumentList;
  form: {
    answers: { fieldId: string; value: AnswerValue }[];
    form: { sections: { fields: FormField[]; id: string; title: string }[] };
  };
}

export interface DocumentReadiness {
  blocked: number;
  ready: boolean;
  totalApplicable: number;
}

async function jsonRequest<T>(
  apiBase: string,
  path: string,
  init?: RequestInit,
) {
  const response = await fetch(`${apiBase}${path}`, {
    credentials: "include",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  return (await response.json()) as T;
}

async function jsonMutation<T>(
  apiBase: string,
  path: string,
  method: string,
  body?: unknown,
) {
  const csrf = await jsonRequest<{ token: string }>(apiBase, "/auth/csrf");
  return jsonRequest<T>(apiBase, path, {
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: { "X-CSRF-Token": csrf.token },
    method,
  });
}

async function multipartMutation<T>(
  apiBase: string,
  path: string,
  form: FormData,
) {
  const csrf = await jsonRequest<{ token: string }>(apiBase, "/auth/csrf");
  const response = await fetch(`${apiBase}${path}`, {
    body: form,
    credentials: "include",
    headers: { "X-CSRF-Token": csrf.token },
    method: "POST",
  });
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  return (await response.json()) as T;
}

function validitySatisfied(item: DocumentSubmission) {
  const version = item.requirement.version;
  if (version.validityRule !== "MAX_AGE_DAYS") return true;
  const issued = item.currentDocumentVersion?.documentIssuedOn;
  if (!issued || version.maxAgeDays === null) return false;
  const age = Date.now() - new Date(`${issued}T00:00:00Z`).getTime();
  return age >= 0 && age <= version.maxAgeDays * 86_400_000;
}

function submissionReady(item: DocumentSubmission) {
  if (!item.applicable || !item.requirement.version.required) return true;
  if (item.status === "EXENTO") return true;
  return (
    (item.status === "EN_REVISION" || item.status === "ACEPTADO") &&
    item.currentDocumentVersion?.technicalStatus === "READY_FOR_REVIEW" &&
    validitySatisfied(item)
  );
}

function readiness(items: DocumentSubmission[]): DocumentReadiness {
  const applicable = items.filter(
    (item) => item.applicable && item.requirement.version.required,
  );
  const blocked = applicable.filter((item) => !submissionReady(item)).length;
  return { blocked, ready: blocked === 0, totalApplicable: applicable.length };
}

const statusLabels: Record<string, string> = {
  ACCEPTED: "Aceptado",
  ACEPTADO: "Aceptado",
  BLOCKED_INFECTED: "Archivo bloqueado",
  BLOCKED_INVALID: "Archivo no válido",
  BLOCKED_SCAN_ERROR: "Revisión técnica pendiente",
  CARGADO: "Cargado",
  EN_REVISION: "En revisión",
  EXENTO: "Exento",
  EXEMPTED: "Exento",
  FALTANTE: "Pendiente",
  OBSERVADO: "Con observaciones",
  OBSERVED: "Con observaciones",
  PROCESSING: "Procesando",
  QUARANTINED: "En revisión técnica",
  READY_FOR_REVIEW: "Listo para revisión",
  REEMPLAZADO: "Reemplazado",
};

function visibleStatus(value: string) {
  return statusLabels[value] ?? "Estado actualizado";
}

function acceptedFileTypes(version: RequirementVersion) {
  const mime = { JPEG: "image/jpeg", PDF: "application/pdf", PNG: "image/png" };
  return version.allowedFileTypes.map((type) => mime[type]).join(",");
}

async function download(apiBase: string, path: string, fallback: string) {
  const response = await fetch(`${apiBase}${path}`, { credentials: "include" });
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = fallback;
  link.click();
  URL.revokeObjectURL(url);
}

export function FamilyDocumentWorkspace({
  apiBase,
  applicationId,
  onBack,
  onContinue,
  onReadinessChange,
  tenantId,
}: {
  apiBase: string;
  applicationId: string;
  onBack: () => void;
  onContinue: () => void;
  onReadinessChange: (state: DocumentReadiness) => void;
  tenantId: string;
}) {
  const root = `/family/tenants/${tenantId}/applications/${applicationId}`;
  const [data, setData] = useState<DocumentList | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("Cargando requisitos documentales…");
  const [uploading, setUploading] = useState("");

  const load = useCallback(async () => {
    try {
      const result = await jsonRequest<DocumentList>(
        apiBase,
        `${root}/documents`,
      );
      setData(result);
      onReadinessChange(readiness(result.items));
      setMessage(
        "Los requisitos corresponden a la versión fijada al crear el borrador.",
      );
    } catch {
      setError("No fue posible cargar los documentos de esta postulación.");
    }
  }, [apiBase, onReadinessChange, root]);

  useEffect(() => {
    const handle = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(handle);
  }, [load]);

  useEffect(() => {
    const pending = data?.items.some((item) =>
      ["QUARANTINED", "PROCESSING"].includes(
        item.currentDocumentVersion?.technicalStatus ?? "",
      ),
    );
    if (!pending) return;
    const handle = window.setInterval(() => void load(), 2500);
    return () => window.clearInterval(handle);
  }, [data, load]);

  async function uploadDocument(
    event: FormEvent<HTMLFormElement>,
    item: DocumentSubmission,
  ) {
    event.preventDefault();
    setError("");
    setUploading(item.id);
    try {
      const form = new FormData(event.currentTarget);
      await multipartMutation(
        apiBase,
        `${root}/document-submissions/${item.id}/upload`,
        form,
      );
      setMessage(
        "Archivo recibido. La revisión técnica se ejecuta en segundo plano.",
      );
      event.currentTarget.reset();
      await load();
    } catch (requestError) {
      setError(
        requestError instanceof Error && requestError.message === "HTTP_413"
          ? "El archivo supera el tamaño permitido."
          : "No se pudo cargar el archivo. Revisa formato, tamaño y fecha.",
      );
    } finally {
      setUploading("");
    }
  }

  const currentReadiness = readiness(data?.items ?? []);
  return (
    <div className="document-stage">
      <div className="section-heading">
        <div>
          <h2>Documentos</h2>
          <p className="muted">
            Sube sólo archivos PDF, JPG o PNG solicitados para esta postulación.
          </p>
        </div>
        <span
          className={
            currentReadiness.ready ? "badge badge-open" : "badge badge-draft"
          }
        >
          {currentReadiness.ready
            ? "Listos para enviar"
            : `${currentReadiness.blocked} pendientes`}
        </span>
      </div>
      <p aria-live="polite" className="form-help">
        {message}
      </p>
      {error ? (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      ) : null}
      {!data ? <p className="empty-state">Cargando requisitos…</p> : null}
      <div className="document-list">
        {data?.items
          .filter((item) => item.applicable)
          .map((item) => (
            <article className="document-card" key={item.id}>
              <div className="document-card-heading">
                <div>
                  <h3>{item.requirement.name}</h3>
                  <p className="muted">
                    {item.requirement.version.instruction}
                  </p>
                </div>
                <span
                  className={
                    submissionReady(item)
                      ? "badge badge-open"
                      : "badge badge-draft"
                  }
                >
                  {visibleStatus(item.status)}
                </span>
              </div>
              <dl className="document-meta">
                <div>
                  <dt>Obligatorio</dt>
                  <dd>{item.requirement.version.required ? "Sí" : "No"}</dd>
                </div>
                <div>
                  <dt>Formatos</dt>
                  <dd>
                    {item.requirement.version.allowedFileTypes.join(", ")}
                  </dd>
                </div>
                <div>
                  <dt>Tamaño máximo</dt>
                  <dd>
                    {Math.ceil(
                      item.requirement.version.maxFileSizeBytes / 1_048_576,
                    )}{" "}
                    MB
                  </dd>
                </div>
                {item.currentDocumentVersion ? (
                  <div>
                    <dt>Revisión técnica</dt>
                    <dd>
                      {visibleStatus(
                        item.currentDocumentVersion.technicalStatus,
                      )}
                    </dd>
                  </div>
                ) : null}
              </dl>
              {item.status === "OBSERVADO" && item.reviews[0]?.reason ? (
                <div className="document-observation" role="status">
                  <strong>Corrección solicitada</strong>
                  <span>{item.reviews[0].reason}</span>
                  {item.correctionDueAt ? (
                    <small>
                      Plazo visible:{" "}
                      {new Date(item.correctionDueAt).toLocaleDateString(
                        "es-CL",
                      )}
                    </small>
                  ) : null}
                </div>
              ) : null}
              {item.status !== "EXENTO" ? (
                <form
                  className="document-upload"
                  onSubmit={(event) => void uploadDocument(event, item)}
                >
                  {item.requirement.version.allowsEquivalent ? (
                    <label className="field">
                      <span>Documento presentado</span>
                      <select name="equivalentOptionCode" required>
                        <option value="">Selecciona una opción</option>
                        {item.requirement.version.equivalentOptions.map(
                          (option) => (
                            <option key={option.code} value={option.code}>
                              {option.label}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                  ) : null}
                  {item.requirement.version.validityRule === "MAX_AGE_DAYS" ? (
                    <label className="field">
                      <span>Fecha de emisión</span>
                      <input
                        max={new Date().toISOString().slice(0, 10)}
                        name="documentIssuedOn"
                        required
                        type="date"
                      />
                      <small>
                        Debe estar dentro de los últimos{" "}
                        {item.requirement.version.maxAgeDays} días.
                      </small>
                    </label>
                  ) : null}
                  <label className="file-field">
                    <span>
                      {item.currentDocumentVersion
                        ? "Reemplazar archivo"
                        : "Elegir archivo"}
                    </span>
                    <input
                      accept={acceptedFileTypes(item.requirement.version)}
                      name="file"
                      required
                      type="file"
                    />
                  </label>
                  <button
                    className="button button-secondary"
                    disabled={uploading === item.id}
                    type="submit"
                  >
                    {uploading === item.id ? "Cargando…" : "Cargar documento"}
                  </button>
                </form>
              ) : null}
              {item.currentDocumentVersion?.technicalStatus ===
              "READY_FOR_REVIEW" ? (
                <button
                  className="text-button"
                  onClick={() =>
                    void download(
                      apiBase,
                      `${root}/document-versions/${item.currentDocumentVersion?.id}/download`,
                      `${item.requirement.code}.bin`,
                    )
                  }
                  type="button"
                >
                  Descargar versión actual
                </button>
              ) : null}
              {item.history.length > 0 ? (
                <details className="document-history">
                  <summary>
                    Historial de versiones ({item.history.length})
                  </summary>
                  <ul>
                    {item.history.map((version) => (
                      <li key={version.id}>
                        Versión {version.versionNumber} ·{" "}
                        {visibleStatus(version.projectedStatus)} ·{" "}
                        {new Date(version.createdAt).toLocaleString("es-CL")}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </article>
          ))}
      </div>
      <div className="readiness-panel" aria-live="polite">
        <strong>
          {currentReadiness.ready
            ? "Documentación lista"
            : "Aún falta documentación"}
        </strong>
        <span>
          {currentReadiness.totalApplicable} requisitos obligatorios aplicables;{" "}
          {currentReadiness.blocked} bloquean el envío.
        </span>
      </div>
      <div className="flow-actions">
        <button
          className="button button-secondary"
          onClick={onBack}
          type="button"
        >
          Atrás
        </button>
        <button
          className="button button-primary"
          onClick={onContinue}
          type="button"
        >
          Continuar a revisión
        </button>
      </div>
    </div>
  );
}

export function DocumentReadinessSummary({
  state,
}: {
  state: DocumentReadiness;
}) {
  return (
    <section className="review-section" aria-labelledby="document-review-title">
      <h3 id="document-review-title">Documentos</h3>
      <p
        className={
          state.ready
            ? "readiness-copy readiness-copy-ready"
            : "readiness-copy readiness-copy-blocked"
        }
      >
        {state.ready
          ? `Los ${state.totalApplicable} requisitos obligatorios aplicables están listos.`
          : `${state.blocked} requisitos documentales aún bloquean el envío.`}
      </p>
    </section>
  );
}

interface RequirementCatalogItem {
  code: string;
  id: string;
  name: string;
  purpose: string;
  versions: RequirementVersion[];
}

export function AdminDocumentRequirements({
  apiBase,
  tenantId,
}: {
  apiBase: string;
  tenantId: string;
}) {
  const root = `/admin/tenants/${tenantId}`;
  const [items, setItems] = useState<RequirementCatalogItem[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("Catálogo no cargado.");

  const load = useCallback(async () => {
    try {
      const result = await jsonRequest<{ items: RequirementCatalogItem[] }>(
        apiBase,
        `${root}/document-requirements`,
      );
      setItems(result.items);
      setMessage(`${result.items.length} requisitos configurados.`);
    } catch {
      setError("No fue posible cargar el catálogo documental.");
    }
  }, [apiBase, root]);

  useEffect(() => {
    const handle = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(handle);
  }, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const requirement = await jsonMutation<{ id: string }>(
        apiBase,
        `${root}/document-requirements`,
        "POST",
        {
          code: form.get("code"),
          name: form.get("name"),
          purpose: form.get("purpose"),
        },
      );
      const allowsEquivalent = form.get("allowsEquivalent") === "on";
      const equivalentOptions = String(form.get("equivalentOptions") ?? "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [code, ...label] = line.split("|");
          return { code, label: label.join("|") };
        });
      const validityRule = String(form.get("validityRule"));
      await jsonMutation(
        apiBase,
        `${root}/document-requirements/${requirement.id}/versions`,
        "POST",
        {
          allowedFileTypes: form.getAll("allowedFileTypes"),
          allowsEquivalent,
          condition: null,
          correctionWindowBusinessDays: Number(
            form.get("correctionWindowBusinessDays"),
          ),
          equivalentOptions: allowsEquivalent ? equivalentOptions : null,
          instruction: String(form.get("instruction") ?? "") || null,
          maxAgeDays:
            validityRule === "MAX_AGE_DAYS"
              ? Number(form.get("maxAgeDays"))
              : null,
          maxFileSizeBytes: Number(form.get("maxFileSizeMb")) * 1_048_576,
          required: form.get("required") === "on",
          scope: {
            academicYearId: String(form.get("academicYearId") ?? "") || null,
            courseLevelId: String(form.get("courseLevelId") ?? "") || null,
            offeringId: String(form.get("offeringId") ?? "") || null,
            processId: String(form.get("processId") ?? "") || null,
          },
          sensitivity: form.get("sensitivity"),
          validityRule,
        },
      );
      event.currentTarget.reset();
      setMessage("Requisito creado como borrador. Revísalo antes de publicar.");
      await load();
    } catch {
      setError(
        "No se pudo crear el requisito. Revisa códigos, opciones, alcance y límites.",
      );
    }
  }

  async function publish(versionId: string) {
    setError("");
    try {
      await jsonMutation(
        apiBase,
        `${root}/document-requirement-versions/${versionId}/publish`,
        "POST",
      );
      setMessage(
        "Versión publicada. Los borradores nuevos fijarán esta configuración exacta.",
      );
      await load();
    } catch {
      setError(
        "No se pudo publicar la versión. Verifica consistencia y permisos.",
      );
    }
  }

  return (
    <div className="document-admin">
      <p className="form-help" aria-live="polite">
        {message}
      </p>
      {error ? (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      ) : null}
      <details className="builder-create">
        <summary>Crear requisito versionado</summary>
        <form
          className="form-card form-wide"
          onSubmit={(event) => void create(event)}
        >
          <label className="field">
            <span>Código estable</span>
            <input name="code" pattern="[A-Za-z0-9][A-Za-z0-9_.:-]*" required />
          </label>
          <label className="field">
            <span>Nombre visible</span>
            <input name="name" required />
          </label>
          <label className="field">
            <span>Propósito</span>
            <input
              defaultValue="admission_application"
              name="purpose"
              required
            />
          </label>
          <label className="field">
            <span>Instrucciones para la familia</span>
            <textarea name="instruction" />
          </label>
          <fieldset className="control-group">
            <legend>Formatos permitidos</legend>
            {["PDF", "JPEG", "PNG"].map((type) => (
              <label className="checkbox-row" key={type}>
                <input
                  defaultChecked={type === "PDF"}
                  name="allowedFileTypes"
                  type="checkbox"
                  value={type}
                />
                <span>{type}</span>
              </label>
            ))}
          </fieldset>
          <label className="field">
            <span>Tamaño máximo (MB)</span>
            <input
              defaultValue="5"
              max="10"
              min="1"
              name="maxFileSizeMb"
              required
              type="number"
            />
          </label>
          <label className="field">
            <span>Regla de vigencia</span>
            <select defaultValue="NONE" name="validityRule">
              <option value="NONE">Sin vigencia temporal</option>
              <option value="LATEST_AVAILABLE">Último disponible</option>
              <option value="MAX_AGE_DAYS">Antigüedad máxima</option>
            </select>
          </label>
          <label className="field">
            <span>Antigüedad máxima (días; sólo si aplica)</span>
            <input defaultValue="30" min="1" name="maxAgeDays" type="number" />
          </label>
          <label className="field">
            <span>Días hábiles para corregir</span>
            <input
              defaultValue="5"
              min="1"
              name="correctionWindowBusinessDays"
              required
              type="number"
            />
          </label>
          <label className="field">
            <span>Sensibilidad</span>
            <select defaultValue="restricted" name="sensitivity">
              <option value="internal">Interna</option>
              <option value="restricted">Restringida</option>
              <option value="highly_restricted">Altamente restringida</option>
            </select>
          </label>
          <label className="checkbox-row">
            <input defaultChecked name="required" type="checkbox" />
            <span>Obligatorio cuando sea aplicable</span>
          </label>
          <label className="checkbox-row">
            <input name="allowsEquivalent" type="checkbox" />
            <span>Permitir documentos equivalentes</span>
          </label>
          <label className="field">
            <span>Equivalentes (código|etiqueta, uno por línea)</span>
            <textarea
              name="equivalentOptions"
              placeholder={"CERT|Certificado\nDECL|Declaración"}
            />
          </label>
          <fieldset className="scope-grid">
            <legend>Alcance opcional por identificador exacto</legend>
            {["academicYearId", "processId", "offeringId", "courseLevelId"].map(
              (name) => (
                <label className="field" key={name}>
                  <span>{name}</span>
                  <input name={name} placeholder="UUID o vacío" />
                </label>
              ),
            )}
          </fieldset>
          <button className="button button-primary" type="submit">
            Guardar borrador
          </button>
        </form>
      </details>
      <div className="document-list">
        {items.length === 0 ? (
          <p className="empty-state">No hay requisitos configurados.</p>
        ) : (
          items.map((item) => (
            <article className="document-card" key={item.id}>
              <div className="document-card-heading">
                <div>
                  <h3>{item.name}</h3>
                  <p className="code">
                    {item.code} · {item.purpose}
                  </p>
                </div>
                <span className="badge">{item.versions.length} versiones</span>
              </div>
              <div className="version-list">
                {item.versions.map((version) => (
                  <div className="version-row" key={version.id}>
                    <span>
                      v{version.versionNumber} · {version.lifecycle} ·{" "}
                      {version.required ? "obligatorio" : "opcional"}
                    </span>
                    {version.lifecycle === "DRAFT" ? (
                      <button
                        className="button button-secondary"
                        onClick={() => void publish(version.id)}
                        type="button"
                      >
                        Publicar
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

export function StaffDocumentWorkspace({
  apiBase,
  tenantId,
}: {
  apiBase: string;
  tenantId: string;
}) {
  const [applicationId, setApplicationId] = useState("");
  const [data, setData] = useState<DocumentList | null>(null);
  const [reason, setReason] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const root = `/staff/tenants/${tenantId}`;

  async function load() {
    setError("");
    try {
      setData(
        await jsonRequest<DocumentList>(
          apiBase,
          `${root}/applications/${applicationId}/documents`,
        ),
      );
    } catch {
      setData(null);
      setError(
        "No se encontró una postulación accesible con ese identificador exacto.",
      );
    }
  }

  async function decide(
    item: DocumentSubmission,
    action: "accept" | "observe" | "exempt",
  ) {
    setError("");
    try {
      await jsonMutation(
        apiBase,
        `${root}/document-submissions/${item.id}/${action}`,
        "POST",
        action === "exempt"
          ? { reason: reason[item.id] ?? "" }
          : {
              expectedDocumentVersionId: item.currentDocumentVersion?.id,
              ...(action === "observe"
                ? { reason: reason[item.id] ?? "" }
                : {}),
            },
      );
      await load();
    } catch {
      setError(
        "La decisión no pudo registrarse. Revisa el permiso, el estado técnico y el motivo.",
      );
    }
  }

  return (
    <div className="staff-workspace">
      <form
        className="lookup-bar"
        onSubmit={(event) => {
          event.preventDefault();
          void load();
        }}
      >
        <label className="field">
          <span>Identificador exacto de postulación</span>
          <input
            onChange={(event) => setApplicationId(event.target.value)}
            required
            value={applicationId}
          />
        </label>
        <button className="button button-primary" type="submit">
          Abrir expediente
        </button>
      </form>
      <p className="form-help">
        No se ofrecen búsquedas globales ni listados de familias.
      </p>
      {error ? (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      ) : null}
      <div className="document-list">
        {data?.items
          .filter((item) => item.applicable)
          .map((item) => (
            <article className="document-card" key={item.id}>
              <div className="document-card-heading">
                <div>
                  <h3>{item.requirement.name}</h3>
                  <p className="muted">{item.requirement.purpose}</p>
                </div>
                <span className="badge">{visibleStatus(item.status)}</span>
              </div>
              <dl className="document-meta">
                <div>
                  <dt>Estado técnico</dt>
                  <dd>
                    {visibleStatus(
                      item.currentDocumentVersion?.technicalStatus ??
                        "FALTANTE",
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Origen</dt>
                  <dd>{item.currentDocumentVersion?.origin ?? "—"}</dd>
                </div>
              </dl>
              {item.currentDocumentVersion?.technicalStatus ===
              "READY_FOR_REVIEW" ? (
                <button
                  className="text-button"
                  onClick={() =>
                    void download(
                      apiBase,
                      `${root}/document-versions/${item.currentDocumentVersion?.id}/download`,
                      `${item.requirement.code}.bin`,
                    )
                  }
                  type="button"
                >
                  Descargar para revisar
                </button>
              ) : null}
              <label className="field">
                <span>Motivo para observar o eximir</span>
                <textarea
                  onChange={(event) =>
                    setReason((current) => ({
                      ...current,
                      [item.id]: event.target.value,
                    }))
                  }
                  value={reason[item.id] ?? ""}
                />
              </label>
              <div className="flow-actions">
                <button
                  className="button button-secondary"
                  disabled={
                    item.currentDocumentVersion?.technicalStatus !==
                    "READY_FOR_REVIEW"
                  }
                  onClick={() => void decide(item, "accept")}
                  type="button"
                >
                  Aceptar
                </button>
                <button
                  className="button button-secondary"
                  disabled={
                    !reason[item.id] ||
                    item.currentDocumentVersion?.technicalStatus !==
                      "READY_FOR_REVIEW"
                  }
                  onClick={() => void decide(item, "observe")}
                  type="button"
                >
                  Observar
                </button>
                <button
                  className="button button-secondary"
                  disabled={!reason[item.id]}
                  onClick={() => void decide(item, "exempt")}
                  type="button"
                >
                  Eximir
                </button>
              </div>
              {item.reviews.length > 0 ? (
                <details className="document-history">
                  <summary>Decisiones registradas</summary>
                  <ul>
                    {item.reviews.map((review) => (
                      <li key={review.id}>
                        {visibleStatus(review.verdict)} ·{" "}
                        {review.reason ?? "sin motivo visible"}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </article>
          ))}
      </div>
    </div>
  );
}

function assistedFieldApplicable(
  field: FormField,
  answers: Record<string, AnswerValue>,
) {
  if (field.condition === null) return true;
  const actual = answers[field.condition.fieldId];
  const expected = field.condition.value;
  if (field.condition.operator === "IN")
    return (
      Array.isArray(expected) &&
      actual !== undefined &&
      expected.includes(actual)
    );
  const equal = !Array.isArray(expected) && actual === expected;
  return field.condition.operator === "EQUALS" ? equal : !equal;
}

export function AssistedApplicationWorkspace({
  apiBase,
  tenantId,
}: {
  apiBase: string;
  tenantId: string;
}) {
  const root = `/staff/tenants/${tenantId}`;
  const [sessionId, setSessionId] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [workflow, setWorkflow] = useState<AssistedWorkflow | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState(
    "Inicia una sesión sólo con el adulto responsable presente.",
  );

  const loadWorkflow = useCallback(
    async (session: string, application: string) => {
      const result = await jsonRequest<AssistedWorkflow>(
        apiBase,
        `${root}/assistance-sessions/${session}/applications/${application}/workflow`,
      );
      setWorkflow(result);
      setAnswers(
        Object.fromEntries(
          result.form.answers.map((answer) => [answer.fieldId, answer.value]),
        ),
      );
    },
    [apiBase, root],
  );

  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const session = await jsonMutation<{ id: string }>(
        apiBase,
        `${root}/assistance-sessions`,
        "POST",
        {
          adultPresentConfirmed: form.get("adultPresentConfirmed") === "on",
          authorizationConfirmed: form.get("authorizationConfirmed") === "on",
          familyProfileId: form.get("familyProfileId"),
        },
      );
      setSessionId(session.id);
      setMessage("Sesión asistida activa y vinculada a este operador.");
    } catch {
      setError(
        "No se pudo iniciar: se exige identificador exacto, adulto presente y autorización confirmada.",
      );
    }
  }

  async function createApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const application = await jsonMutation<{ id: string }>(
        apiBase,
        `${root}/assistance-sessions/${sessionId}/applications`,
        "POST",
        {
          offeringId: form.get("offeringId"),
          studentId: form.get("studentId"),
        },
      );
      setApplicationId(application.id);
      await loadWorkflow(sessionId, application.id);
      setMessage(
        "Borrador asistido creado con formulario y requisitos fijados.",
      );
    } catch {
      setError(
        "No se pudo crear el borrador para esos identificadores exactos.",
      );
    }
  }

  async function saveAnswers() {
    try {
      await jsonMutation(
        apiBase,
        `${root}/assistance-sessions/${sessionId}/applications/${applicationId}/answers`,
        "PUT",
        {
          answers: Object.entries(answers).map(([fieldId, value]) => ({
            fieldId,
            value,
          })),
        },
      );
      await loadWorkflow(sessionId, applicationId);
      setMessage("Respuestas guardadas mediante el flujo compartido.");
    } catch {
      setError("No se pudieron guardar las respuestas aplicables.");
    }
  }

  async function uploadAssisted(
    event: FormEvent<HTMLFormElement>,
    item: DocumentSubmission,
  ) {
    event.preventDefault();
    try {
      await multipartMutation(
        apiBase,
        `${root}/assistance-sessions/${sessionId}/applications/${applicationId}/document-submissions/${item.id}/upload`,
        new FormData(event.currentTarget),
      );
      await loadWorkflow(sessionId, applicationId);
      setMessage(
        "Documento asistido recibido; la revisión técnica es asíncrona.",
      );
    } catch {
      setError("No se pudo recibir el documento asistido.");
    }
  }

  async function submit() {
    try {
      await jsonMutation(
        apiBase,
        `${root}/assistance-sessions/${sessionId}/applications/${applicationId}/submit`,
        "POST",
      );
      setMessage(
        "Postulación asistida enviada. La trazabilidad conserva operador y adulto responsable.",
      );
      setWorkflow(null);
      setApplicationId("");
    } catch {
      setError(
        "No se pudo enviar. Revisa campos obligatorios y documentos listos.",
      );
    }
  }

  async function close() {
    try {
      await jsonMutation(
        apiBase,
        `${root}/assistance-sessions/${sessionId}/close`,
        "POST",
      );
      setSessionId("");
      setApplicationId("");
      setWorkflow(null);
      setMessage("Sesión asistida cerrada.");
    } catch {
      setError("No fue posible cerrar la sesión activa.");
    }
  }

  const assistedReadiness = readiness(workflow?.documents.items ?? []);
  return (
    <div className="assistance-workspace">
      <div className="assistance-banner" role="status">
        <strong>Modo asistido</strong>
        <span>
          Las acciones se realizan en presencia y con autorización del adulto
          responsable. No es suplantación.
        </span>
      </div>
      <p className="form-help" aria-live="polite">
        {message}
      </p>
      {error ? (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      ) : null}
      {!sessionId ? (
        <form
          className="form-card form-wide"
          onSubmit={(event) => void start(event)}
        >
          <label className="field">
            <span>Identificador exacto del perfil familiar</span>
            <input name="familyProfileId" required />
          </label>
          <label className="checkbox-row">
            <input name="adultPresentConfirmed" required type="checkbox" />
            <span>Confirmo que el adulto responsable está presente</span>
          </label>
          <label className="checkbox-row">
            <input name="authorizationConfirmed" required type="checkbox" />
            <span>Confirmo su autorización para esta asistencia</span>
          </label>
          <button className="button button-primary" type="submit">
            Iniciar sesión asistida
          </button>
        </form>
      ) : null}
      {sessionId && !applicationId ? (
        <form
          className="form-card form-wide"
          onSubmit={(event) => void createApplication(event)}
        >
          <p className="code">Sesión activa: {sessionId}</p>
          <label className="field">
            <span>Identificador exacto del estudiante</span>
            <input name="studentId" required />
          </label>
          <label className="field">
            <span>Identificador exacto de la oferta</span>
            <input name="offeringId" required />
          </label>
          <button className="button button-primary" type="submit">
            Crear borrador asistido
          </button>
        </form>
      ) : null}
      {workflow ? (
        <div className="assisted-flow">
          {workflow.form.form.sections.map((section) => (
            <section className="review-section" key={section.id}>
              <h3>{section.title}</h3>
              <div className="dynamic-form">
                {section.fields
                  .filter((field) => assistedFieldApplicable(field, answers))
                  .map((field) => (
                    <AssistedField
                      answers={answers}
                      field={field}
                      key={field.id}
                      setAnswers={setAnswers}
                    />
                  ))}
              </div>
            </section>
          ))}
          <button
            className="button button-secondary"
            onClick={() => void saveAnswers()}
            type="button"
          >
            Guardar respuestas
          </button>
          <section className="review-section">
            <h3>Documentos recibidos en atención</h3>
            <div className="document-list">
              {workflow.documents.items
                .filter((item) => item.applicable)
                .map((item) => (
                  <form
                    className="document-upload"
                    key={item.id}
                    onSubmit={(event) => void uploadAssisted(event, item)}
                  >
                    <strong>{item.requirement.name}</strong>
                    <label className="field">
                      <span>Origen</span>
                      <select name="origin">
                        <option value="ASSISTED">
                          Archivo digital presentado
                        </option>
                        <option value="PHYSICAL_DOCUMENT">
                          Documento físico digitalizado
                        </option>
                      </select>
                    </label>
                    {item.requirement.version.validityRule ===
                    "MAX_AGE_DAYS" ? (
                      <label className="field">
                        <span>Fecha de emisión</span>
                        <input name="documentIssuedOn" required type="date" />
                      </label>
                    ) : null}
                    <label className="file-field">
                      <span>Archivo</span>
                      <input
                        accept={acceptedFileTypes(item.requirement.version)}
                        name="file"
                        required
                        type="file"
                      />
                    </label>
                    <span className="badge">
                      {visibleStatus(
                        item.currentDocumentVersion?.technicalStatus ??
                          item.status,
                      )}
                    </span>
                    <button className="button button-secondary" type="submit">
                      Recibir documento
                    </button>
                  </form>
                ))}
            </div>
          </section>
          <div className="readiness-panel">
            <strong>
              {assistedReadiness.ready
                ? "Expediente listo"
                : "Expediente incompleto"}
            </strong>
            <span>
              {assistedReadiness.blocked} documentos bloquean el envío.
            </span>
          </div>
          <div className="flow-actions">
            <button
              className="button button-secondary"
              onClick={() => void close()}
              type="button"
            >
              Cerrar sesión
            </button>
            <button
              className="button button-primary"
              disabled={!assistedReadiness.ready}
              onClick={() => void submit()}
              type="button"
            >
              Enviar postulación asistida
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AssistedField({
  answers,
  field,
  setAnswers,
}: {
  answers: Record<string, AnswerValue>;
  field: FormField;
  setAnswers: (value: Record<string, AnswerValue>) => void;
}) {
  const update = (value: AnswerValue) =>
    setAnswers({ ...answers, [field.id]: value });
  if (field.type === "BOOLEAN")
    return (
      <label className="checkbox-row">
        <input
          checked={answers[field.id] === true}
          onChange={(event) => update(event.target.checked)}
          type="checkbox"
        />
        <span>
          {field.label}
          {field.required ? " *" : ""}
        </span>
      </label>
    );
  if (field.type === "SELECT" || field.type === "RADIO")
    return (
      <label className="field">
        <span>
          {field.label}
          {field.required ? " *" : ""}
        </span>
        <select
          onChange={(event) => update(event.target.value)}
          required={field.required}
          value={String(answers[field.id] ?? "")}
        >
          <option value="">Selecciona</option>
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  if (field.type === "TEXTAREA")
    return (
      <label className="field">
        <span>
          {field.label}
          {field.required ? " *" : ""}
        </span>
        <textarea
          onChange={(event) => update(event.target.value)}
          required={field.required}
          value={String(answers[field.id] ?? "")}
        />
      </label>
    );
  return (
    <label className="field">
      <span>
        {field.label}
        {field.required ? " *" : ""}
      </span>
      <input
        onChange={(event) => update(event.target.value)}
        required={field.required}
        type={field.type === "DATE" ? "date" : "text"}
        value={String(answers[field.id] ?? "")}
      />
    </label>
  );
}
