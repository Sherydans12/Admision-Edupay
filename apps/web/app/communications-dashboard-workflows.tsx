"use client";

import { useCallback, useEffect, useState } from "react";

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
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
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
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    headers: { "X-CSRF-Token": csrf.token },
    method,
  });
}

export interface DashboardMetrics {
  documentCorrectionsExpiringCount: number;
  documentsPendingReviewCount: number;
  newApplicationsCount: number;
  offersExpiringCount: number;
  upcomingAppointmentsCount: number;
  waitingDecisionCount: number;
  waitlistCount: number;
}

export interface CommunicationDto {
  body: string;
  confirmedAt: string | null;
  confirmedBy: string | null;
  createdAt: string;
  id: string;
  lifecycle: "PREPARED" | "CONFIRMED" | "SENT" | "DELIVERED" | "FAILED";
  purpose: string;
  recipientEmail: string;
  subject: string;
  versionNumber: number;
}

export function StaffDashboardWorkspace(props: {
  apiBase: string;
  tenantId: string;
}) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await apiFetch<DashboardMetrics>(
        props.apiBase,
        `/staff/tenants/${props.tenantId}/dashboard/metrics`,
      );
      setMetrics(result);
    } catch {
      setError("No fue posible cargar las métricas del dashboard operativo.");
    } finally {
      setLoading(false);
    }
  }, [props.apiBase, props.tenantId]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadMetrics();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [loadMetrics]);

  return (
    <div className="workspace-section staff-overview">
      <div className="workspace-intro">
        <div>
          <h2>Resumen de atención</h2>
          <p>
            Prioriza expedientes y seguimientos del tenant activo. Las cifras
            son agregadas y no reemplazan la autorización de cada acción.
          </p>
        </div>
        <button
          className="button button-quiet"
          disabled={loading}
          onClick={loadMetrics}
          type="button"
        >
          {loading ? "Actualizando…" : "Actualizar métricas"}
        </button>
      </div>

      {error ? (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      ) : null}

      {loading && !metrics ? <p className="muted">Cargando métricas…</p> : null}
      {metrics ? (
        <>
          <section
            className="metric-cluster"
            aria-labelledby="attention-queue-title"
          >
            <div className="metric-cluster-heading">
              <h3 id="attention-queue-title">Colas de atención</h3>
              <span className="muted">Revisa primero lo que puede vencer.</span>
            </div>
            <div className="metric-grid staff-metric-grid">
              <div className="metric metric-priority">
                <span>Nuevas postulaciones</span>
                <strong>{metrics.newApplicationsCount}</strong>
              </div>
              <div className="metric metric-priority">
                <span>Documentos por revisar</span>
                <strong>{metrics.documentsPendingReviewCount}</strong>
              </div>
              <div className="metric metric-priority">
                <span>Correcciones venciendo</span>
                <strong>{metrics.documentCorrectionsExpiringCount}</strong>
              </div>
              <div className="metric metric-priority">
                <span>Esperando decisión</span>
                <strong>{metrics.waitingDecisionCount}</strong>
              </div>
            </div>
          </section>
          <section
            className="metric-cluster"
            aria-labelledby="attention-followup-title"
          >
            <div className="metric-cluster-heading">
              <h3 id="attention-followup-title">Agenda y disponibilidad</h3>
              <span className="muted">
                Señales para planificar el seguimiento.
              </span>
            </div>
            <div className="metric-grid staff-metric-grid staff-metric-grid-secondary">
              <div className="metric">
                <span>Citas próximas</span>
                <strong>{metrics.upcomingAppointmentsCount}</strong>
              </div>
              <div className="metric">
                <span>Ofertas por vencer</span>
                <strong>{metrics.offersExpiringCount}</strong>
              </div>
              <div className="metric">
                <span>Lista de espera</span>
                <strong>{metrics.waitlistCount}</strong>
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

export function StaffCommunicationsWorkspace(props: {
  apiBase: string;
  applicationId: string;
  tenantId: string;
}) {
  const [communications, setCommunications] = useState<CommunicationDto[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [purpose, setPurpose] = useState("TELEPHONE_FOLLOWUP");
  const [outcome, setOutcome] = useState("CONTACT_ESTABLISHED");
  const [notes, setNotes] = useState("");

  const loadCommunications = useCallback(async () => {
    if (!props.applicationId) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch<{ items: CommunicationDto[] }>(
        props.apiBase,
        `/staff/tenants/${props.tenantId}/applications/${props.applicationId}/communications`,
      );
      setCommunications(res.items);
    } catch {
      setError("No se pudieron cargar las comunicaciones del expediente.");
    } finally {
      setLoading(false);
    }
  }, [props.apiBase, props.applicationId, props.tenantId]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadCommunications();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [loadCommunications]);

  async function handleConfirm(
    communicationId: string,
    expectedVersion: number,
  ) {
    setError("");
    setNotice("");
    try {
      await mutate(
        props.apiBase,
        `/staff/tenants/${props.tenantId}/communications/${communicationId}/confirm`,
        "POST",
        { expectedVersion },
      );
      setNotice("Envío de comunicación confirmado por el Responsable.");
      await loadCommunications();
    } catch {
      setError(
        "No se pudo confirmar el envío. Requiere capacidad de confirmación autorizada.",
      );
    }
  }

  async function handleRetry(communicationId: string) {
    setError("");
    setNotice("");
    try {
      await mutate(
        props.apiBase,
        `/staff/tenants/${props.tenantId}/communications/${communicationId}/retry`,
        "POST",
      );
      setNotice("Reintento de envío agendado.");
      await loadCommunications();
    } catch {
      setError("No se pudo agendar el reintento de la comunicación.");
    }
  }

  async function handleRecordManualContact(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
      await mutate(
        props.apiBase,
        `/staff/tenants/${props.tenantId}/applications/${props.applicationId}/manual-contacts`,
        "POST",
        { notes: notes || undefined, outcome, purpose },
      );
      setNotice("Contacto manual registrado en la bitácora.");
      setNotes("");
    } catch {
      setError("No se pudo registrar el contacto manual.");
    }
  }

  if (!props.applicationId) {
    return (
      <div className="alert alert-info">
        Ingresa un ID de postulación exacto para gestionar comunicaciones.
      </div>
    );
  }

  return (
    <div className="workspace-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Comunicaciones & Notificaciones</p>
          <h2>Bandeja de Envíos y Confirmaciones</h2>
        </div>
      </div>

      {error ? (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="alert alert-success" role="status">
          {notice}
        </div>
      ) : null}

      <div className="split-grid">
        <article className="info-card">
          <h3>Comunicaciones registradas</h3>
          {loading ? <p className="muted">Cargando...</p> : null}
          <div className="stack-list">
            {communications.length === 0 ? (
              <p className="empty-state">
                No hay comunicaciones para esta postulación.
              </p>
            ) : (
              communications.map((comm) => (
                <div className="communication-item" key={comm.id}>
                  <div className="item-header">
                    <span
                      className={`badge badge-${comm.lifecycle.toLowerCase()}`}
                    >
                      {comm.lifecycle}
                    </span>
                    <small>
                      {new Date(comm.createdAt).toLocaleString("es-CL")}
                    </small>
                  </div>
                  <h4>{comm.subject}</h4>
                  <p className="muted">{comm.recipientEmail}</p>
                  <p className="body-preview">{comm.body}</p>

                  {comm.lifecycle === "PREPARED" ? (
                    <button
                      className="button button-primary"
                      onClick={() => handleConfirm(comm.id, comm.versionNumber)}
                    >
                      Confirmar envío (Responsable)
                    </button>
                  ) : null}

                  {comm.lifecycle === "FAILED" ? (
                    <button
                      className="button button-secondary"
                      onClick={() => handleRetry(comm.id)}
                    >
                      Reintentar envío
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </article>

        <form className="form-card" onSubmit={handleRecordManualContact}>
          <h3>Registrar contacto manual</h3>
          <label className="field">
            <span>Propósito</span>
            <input
              required
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Resultado operacional</span>
            <input
              required
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Notas operacionales (opcional)</span>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <button className="button button-primary" type="submit">
            Registrar contacto
          </button>
        </form>
      </div>
    </div>
  );
}
