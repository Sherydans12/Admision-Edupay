"use client";

import { useEffect, useRef, useState } from "react";

type RecommendationOption =
  "RECOMENDAR_ADMISION" | "NO_RECOMENDAR_ADMISION" | "DEVOLVER_A_REVISION";
type DirectionDisposition =
  "APROBADO" | "LISTA_DE_ESPERA" | "RECHAZADO" | "DEVUELTO_A_REVISION";

interface Version {
  createdAt: string;
  evidenceManifest: Record<string, unknown>;
  foundation: string;
  id: string;
  lifecycle: "DRAFT" | "SUBMITTED";
  option: RecommendationOption;
  previousVersionId: string | null;
  submittedAt: string | null;
  versionNumber: number;
}

interface DecisionVersion {
  decidedAt: string;
  disposition: DirectionDisposition;
  foundation: string | null;
  id: string;
  previousVersionId: string | null;
  reason: string | null;
  recommendationVersionId: string;
  versionNumber: number;
}

interface Workspace {
  application: {
    id: string;
    offering: {
      campus: string;
      courseLevel: string;
      process: string;
      title: string;
    };
    status: string;
    student: { familyName: string; givenName: string };
    submittedAt: string | null;
  };
  direction: { current: DecisionVersion | null; history: DecisionVersion[] };
  readiness: {
    activities: Array<{ id: string; status: string }>;
    applicationSubmitted: boolean;
    documentStatuses: Array<{ id: string; status: string }>;
    sensitiveActivityResultsIncluded: boolean;
    warning: string | null;
  };
  recommendation: {
    currentSubmitted: Version | null;
    draft: Version | null;
    history: Version[];
  };
}

class ApiError extends Error {
  constructor(readonly status: number) {
    super(`HTTP_${status}`);
  }
}

async function apiFetch<T>(
  apiBase: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    credentials: "include",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!response.ok) throw new ApiError(response.status);
  return (await response.json()) as T;
}

async function mutate<T>(
  apiBase: string,
  path: string,
  method: string,
  body?: unknown,
): Promise<T> {
  const csrf = await apiFetch<{ token: string }>(apiBase, "/auth/csrf");
  return apiFetch<T>(apiBase, path, {
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: { "X-CSRF-Token": csrf.token },
    method,
  });
}

function optionLabel(option: RecommendationOption): string {
  return {
    DEVOLVER_A_REVISION: "Devolver a revisión",
    NO_RECOMENDAR_ADMISION: "No recomendar admisión",
    RECOMENDAR_ADMISION: "Recomendar admisión",
  }[option];
}

function dispositionLabel(disposition: DirectionDisposition): string {
  return {
    APROBADO: "Aprobado",
    DEVUELTO_A_REVISION: "Devuelto a revisión",
    LISTA_DE_ESPERA: "Lista de espera",
    RECHAZADO: "Rechazado",
  }[disposition];
}

function applicationPath(
  tenantId: string,
  applicationId: string,
  suffix: string,
): string {
  return `/staff/tenants/${tenantId}/applications/${applicationId}/${suffix}`;
}

function ConfirmationDialog({
  description,
  onCancel,
  onConfirm,
  open,
  title,
}: {
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  title: string;
}) {
  const confirm = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) confirm.current?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <div
      aria-labelledby="confirmation-title"
      aria-modal="true"
      className="confirmation-dialog-shell"
      role="dialog"
    >
      <div className="confirmation-dialog-card">
        <h3 id="confirmation-title">{title}</h3>
        <p>{description}</p>
        <div className="flow-actions">
          <button
            className="button button-secondary"
            onClick={onCancel}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="button button-primary"
            onClick={onConfirm}
            ref={confirm}
            type="button"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

export function StaffRecommendationWorkspace({
  apiBase,
  tenantId,
}: {
  apiBase: string;
  tenantId: string;
}) {
  const [applicationId, setApplicationId] = useState("");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [option, setOption] = useState<RecommendationOption>(
    "RECOMENDAR_ADMISION",
  );
  const [foundation, setFoundation] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirming, setConfirming] = useState(false);

  async function load() {
    if (!applicationId) return;
    try {
      const result = await apiFetch<Workspace>(
        apiBase,
        applicationPath(tenantId, applicationId, "recommendation-workspace"),
      );
      setWorkspace(result);
      const draft = result.recommendation.draft;
      if (draft) {
        setOption(draft.option);
        setFoundation(draft.foundation);
      }
      setError("");
    } catch {
      setError("No se pudo cargar la recomendación interna para ese caso.");
    }
  }

  async function saveDraft() {
    try {
      const draft = workspace?.recommendation.draft;
      const body = { foundation, option };
      if (draft) {
        await mutate(
          apiBase,
          `/staff/tenants/${tenantId}/recommendation-versions/${draft.id}`,
          "PATCH",
          body,
        );
      } else {
        await mutate(
          apiBase,
          applicationPath(tenantId, applicationId, "recommendations/drafts"),
          "POST",
          body,
        );
      }
      setNotice("Borrador guardado. Todavía no se ha enviado a Dirección.");
      await load();
    } catch {
      setError(
        "No se pudo guardar el borrador. Revisa fundamento, permiso y estado del caso.",
      );
    }
  }

  async function submit() {
    const draft = workspace?.recommendation.draft;
    if (!draft) return;
    try {
      await mutate(
        apiBase,
        `/staff/tenants/${tenantId}/recommendation-versions/${draft.id}/submit`,
        "POST",
      );
      setConfirming(false);
      setNotice("Recomendación enviada a Dirección y sellada como inmutable.");
      await load();
    } catch (requestError) {
      setConfirming(false);
      setError(
        requestError instanceof ApiError && requestError.status === 409
          ? "La recomendación cambió. Recarga el caso antes de enviarlo."
          : "No se pudo enviar la recomendación.",
      );
    }
  }

  return (
    <div className="recommendation-workspace">
      <div className="lookup-bar">
        <label className="field">
          <span>Application ID sintético</span>
          <input
            onChange={(event) => setApplicationId(event.target.value)}
            required
            value={applicationId}
          />
        </label>
        <button
          className="button button-primary"
          onClick={() => void load()}
          type="button"
        >
          Cargar caso
        </button>
      </div>
      {error ? (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p aria-live="polite" className="readiness-copy readiness-copy-ready">
          {notice}
        </p>
      ) : null}
      {workspace ? (
        <>
          <CaseSummary workspace={workspace} />
          {!workspace.readiness.applicationSubmitted ? (
            <p className="readiness-copy readiness-copy-blocked">
              La postulación debe estar enviada antes de registrar una
              recomendación.
            </p>
          ) : null}
          {workspace.readiness.warning ? (
            <p className="readiness-copy readiness-copy-warning">
              Antecedentes requieren revisión. Este aviso no decide por el
              actor.
            </p>
          ) : null}
          <section
            aria-labelledby="recommendation-title"
            className="review-section"
          >
            <p className="eyebrow">SCR-STAFF-011</p>
            <h3 id="recommendation-title">Recomendación interna</h3>
            <fieldset className="control-group recommendation-options">
              <legend>Selecciona una opción</legend>
              {(
                [
                  "RECOMENDAR_ADMISION",
                  "NO_RECOMENDAR_ADMISION",
                  "DEVOLVER_A_REVISION",
                ] as RecommendationOption[]
              ).map((value) => (
                <label className="choice-card" key={value}>
                  <input
                    checked={option === value}
                    name="recommendation-option"
                    onChange={() => setOption(value)}
                    type="radio"
                  />
                  <span>{optionLabel(value)}</span>
                </label>
              ))}
            </fieldset>
            <label className="field">
              <span>
                Fundamento{" "}
                <strong className="required-mark">(obligatorio)</strong>
              </span>
              <textarea
                aria-describedby="recommendation-foundation-help"
                aria-invalid={!foundation.trim()}
                onChange={(event) => setFoundation(event.target.value)}
                required
                value={foundation}
              />
              <small id="recommendation-foundation-help">
                Texto interno, sin HTML activo ni enlaces ejecutables.
              </small>
            </label>
            <div className="flow-actions">
              <button
                className="button button-secondary"
                disabled={!workspace.readiness.applicationSubmitted}
                onClick={() => void saveDraft()}
                type="button"
              >
                Guardar borrador
              </button>
              <button
                className="button button-primary"
                disabled={
                  !workspace.readiness.applicationSubmitted ||
                  !workspace.recommendation.draft ||
                  !foundation.trim()
                }
                onClick={() => setConfirming(true)}
                type="button"
              >
                Enviar a Dirección
              </button>
            </div>
            {workspace.recommendation.draft ? (
              <p className="muted">
                Versión DRAFT {workspace.recommendation.draft.versionNumber}. Al
                enviar quedará IMMUTABLE.
              </p>
            ) : (
              <p className="muted">
                Guarda un borrador para habilitar el envío.
              </p>
            )}
          </section>
          <VersionHistory versions={workspace.recommendation.history} />
          <ConfirmationDialog
            description="La recomendación será visible para Dirección como antecedente interno y esta versión ya no podrá editarse."
            onCancel={() => setConfirming(false)}
            onConfirm={() => void submit()}
            open={confirming}
            title="Confirmar envío a Dirección"
          />
        </>
      ) : null}
    </div>
  );
}

export function StaffDirectionWorkspace({
  apiBase,
  tenantId,
}: {
  apiBase: string;
  tenantId: string;
}) {
  const [applicationId, setApplicationId] = useState("");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [disposition, setDisposition] =
    useState<DirectionDisposition>("APROBADO");
  const [foundation, setFoundation] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirming, setConfirming] = useState(false);

  async function load() {
    if (!applicationId) return;
    try {
      setWorkspace(
        await apiFetch<Workspace>(
          apiBase,
          applicationPath(tenantId, applicationId, "direction-workspace"),
        ),
      );
      setError("");
    } catch {
      setError("No se pudo cargar el caso para Dirección.");
    }
  }

  async function decide() {
    const recommendation = workspace?.recommendation.currentSubmitted;
    if (!recommendation) return;
    try {
      await mutate(
        apiBase,
        applicationPath(tenantId, applicationId, "direction-decisions"),
        "POST",
        {
          disposition,
          expectedRecommendationVersionId: recommendation.id,
          foundation: foundation.trim() || null,
          reason: reason.trim() || null,
        },
      );
      setConfirming(false);
      setNotice(
        "Disposición registrada y auditada. Los efectos posteriores aún no se crean en E5-E.",
      );
      await load();
    } catch (requestError) {
      setConfirming(false);
      setError(
        requestError instanceof ApiError && requestError.status === 409
          ? "La recomendación cambió o el caso ya tiene una disposición. Recarga el workspace."
          : "No se pudo registrar la disposición.",
      );
    }
  }

  const recommendation = workspace?.recommendation.currentSubmitted;
  const final =
    workspace?.direction.current &&
    workspace.direction.current.disposition !== "DEVUELTO_A_REVISION";
  return (
    <div className="recommendation-workspace">
      <div className="lookup-bar">
        <label className="field">
          <span>Application ID sintético</span>
          <input
            onChange={(event) => setApplicationId(event.target.value)}
            required
            value={applicationId}
          />
        </label>
        <button
          className="button button-primary"
          onClick={() => void load()}
          type="button"
        >
          Cargar caso
        </button>
      </div>
      {error ? (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p aria-live="polite" className="readiness-copy readiness-copy-ready">
          {notice}
        </p>
      ) : null}
      {workspace ? (
        <>
          <CaseSummary workspace={workspace} />
          {recommendation ? (
            <section className="review-section">
              <p className="eyebrow">SCR-STAFF-012</p>
              <h3>Antecedente interno: recomendación enviada</h3>
              <p>
                <strong>{optionLabel(recommendation.option)}</strong> · versión{" "}
                {recommendation.versionNumber}
              </p>
              <p className="internal-foundation">{recommendation.foundation}</p>
              {!workspace.readiness.sensitiveActivityResultsIncluded ? (
                <p className="restricted-copy">
                  Información restringida no disponible
                </p>
              ) : null}
            </section>
          ) : (
            <p className="readiness-copy readiness-copy-blocked">
              Dirección sólo puede decidir cuando existe una
              RecommendationVersion SUBMITTED.
            </p>
          )}
          {recommendation && !final ? (
            <section
              aria-labelledby="decision-title"
              className="review-section"
            >
              <h3 id="decision-title">Registrar disposición de Dirección</h3>
              <fieldset className="control-group recommendation-options">
                <legend>Selecciona una disposición</legend>
                {(
                  [
                    "APROBADO",
                    "LISTA_DE_ESPERA",
                    "RECHAZADO",
                    "DEVUELTO_A_REVISION",
                  ] as DirectionDisposition[]
                ).map((value) => (
                  <label className="choice-card" key={value}>
                    <input
                      checked={disposition === value}
                      name="direction-disposition"
                      onChange={() => setDisposition(value)}
                      type="radio"
                    />
                    <span>{dispositionLabel(value)}</span>
                  </label>
                ))}
              </fieldset>
              <div className="effect-card" aria-live="polite">
                {disposition === "APROBADO"
                  ? "Registra decisión favorable. Reserva/oferta se procesarán en la etapa correspondiente."
                  : null}
                {disposition === "LISTA_DE_ESPERA"
                  ? "No crea oferta inmediata."
                  : null}
                {disposition === "RECHAZADO"
                  ? "Registra disposición negativa."
                  : null}
                {disposition === "DEVUELTO_A_REVISION"
                  ? "Regresa el caso a revisión de Admisión y no constituye decisión definitiva."
                  : null}
              </div>
              {disposition === "RECHAZADO" ? (
                <label className="field">
                  <span>
                    Fundamento{" "}
                    <strong className="required-mark">(obligatorio)</strong>
                  </span>
                  <textarea
                    required
                    value={foundation}
                    onChange={(event) => setFoundation(event.target.value)}
                  />
                </label>
              ) : null}
              {disposition === "DEVUELTO_A_REVISION" ? (
                <label className="field">
                  <span>
                    Motivo{" "}
                    <strong className="required-mark">(obligatorio)</strong>
                  </span>
                  <textarea
                    required
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </label>
              ) : null}
              {disposition === "APROBADO" ||
              disposition === "LISTA_DE_ESPERA" ? (
                <label className="field">
                  <span>Comentario interno (opcional)</span>
                  <textarea
                    value={foundation}
                    onChange={(event) => setFoundation(event.target.value)}
                  />
                </label>
              ) : null}
              <div className="flow-actions">
                <button
                  className="button button-primary"
                  onClick={() => setConfirming(true)}
                  type="button"
                >
                  Confirmar disposición
                </button>
              </div>
              <p className="muted">
                E5-E no crea reserva, oferta, comunicación, deadline,
                WaitlistEntry ni handoff.
              </p>
            </section>
          ) : null}
          <DecisionHistory decisions={workspace.direction.history} />
          <ConfirmationDialog
            description="La disposición será una nueva versión histórica vinculada a la recomendación esperada."
            onCancel={() => setConfirming(false)}
            onConfirm={() => void decide()}
            open={confirming}
            title="Confirmar disposición"
          />
        </>
      ) : null}
    </div>
  );
}

function CaseSummary({ workspace }: { workspace: Workspace }) {
  return (
    <section className="review-section">
      <p className="eyebrow">Workspace mínimo del caso</p>
      <h3>
        {workspace.application.student.givenName}{" "}
        {workspace.application.student.familyName}
      </h3>
      <dl className="detail-list">
        <div>
          <dt>Postulación</dt>
          <dd>{workspace.application.status}</dd>
        </div>
        <div>
          <dt>Oferta</dt>
          <dd>{workspace.application.offering.title}</dd>
        </div>
        <div>
          <dt>Sede / curso</dt>
          <dd>
            {workspace.application.offering.campus} ·{" "}
            {workspace.application.offering.courseLevel}
          </dd>
        </div>
        <div>
          <dt>Documentos / actividades</dt>
          <dd>
            {workspace.readiness.documentStatuses.length} /{" "}
            {workspace.readiness.activities.length}
          </dd>
        </div>
      </dl>
    </section>
  );
}

function VersionHistory({ versions }: { versions: Version[] }) {
  return (
    <section className="review-section">
      <h3>Historia de versiones autorizada</h3>
      {versions.length === 0 ? (
        <p className="muted">Sin versiones.</p>
      ) : (
        <ol className="history-list">
          {versions.map((version) => (
            <li key={version.id}>
              <strong>V{version.versionNumber}</strong> ·{" "}
              {optionLabel(version.option)} · {version.lifecycle}
              {version.submittedAt
                ? ` · ${new Date(version.submittedAt).toLocaleString()}`
                : ""}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function DecisionHistory({ decisions }: { decisions: DecisionVersion[] }) {
  return (
    <section className="review-section">
      <h3>Historia de disposiciones</h3>
      {decisions.length === 0 ? (
        <p className="muted">Sin disposiciones.</p>
      ) : (
        <ol className="history-list">
          {decisions.map((decision) => (
            <li key={decision.id}>
              <strong>V{decision.versionNumber}</strong> ·{" "}
              {dispositionLabel(decision.disposition)} ·{" "}
              {new Date(decision.decidedAt).toLocaleString()}
              {decision.reason ? ` · ${decision.reason}` : ""}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
