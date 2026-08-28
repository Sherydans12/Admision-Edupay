"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Capacity {
  adjustments: Array<{
    actorId: string;
    createdAt: string;
    id: string;
    newValue: number;
    previousValue: number;
    reason: string;
  }>;
  availableCount: number;
  concurrencyVersion: number;
  configuredCapacity: number;
  consumedCount: number;
  id: string;
  offerValidityBusinessDays: number;
  offeringId: string;
}

interface OfferingReadiness {
  blockers: string[];
  capacityState:
    | "CAPACITY_NOT_CONFIGURED"
    | "CAPACITY_CONFIGURED_ZERO"
    | "CAPACITY_CONFIGURED_POSITIVE";
  capacityVersion: number | null;
  lifecycle: "DRAFT" | "PUBLISHED" | "CLOSED";
  offeringId: string;
  offeringVersion: number;
  publishable: boolean;
}

interface ConfigurationOffering {
  availabilityLabel: string;
  code: string;
  id: string;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  title: string;
}

interface WaitlistEntry {
  applicationId: string;
  concurrencyVersion: number;
  enteredAt: string;
  id: string;
  internalPosition: number;
  state: "ACTIVE" | "PROMOTED" | "WITHDRAWN";
}

interface OfferVersion {
  expiresAt: string;
  id: string;
  issuedAt: string;
  lifecycle: "ACTIVE" | "ACCEPTED" | "DECLINED" | "EXPIRED";
  origin: "NORMAL" | "WAITLIST";
  reopenReason: string | null;
  terminalAt: string | null;
  versionNumber: number;
}

interface Offer {
  applicationId: string;
  current: OfferVersion;
  history: OfferVersion[];
  id: string;
  origin: "NORMAL" | "WAITLIST";
}

interface FunctionalHandoff {
  applicationId: string;
  createdAt: string;
  id: string;
  offerAcceptanceId: string;
  requestedAt: string;
  status: "REQUESTED";
}

interface FamilyProjection {
  applicationId: string;
  applicationStatus: string;
  offer: Offer | null;
  waitlist: null | {
    enteredAt: string;
    state: "ACTIVE" | "PROMOTED" | "WITHDRAWN";
    updatedAt: string;
  };
  withdrawal: null | { confirmedAt: string };
}

class ApiError extends Error {
  constructor(readonly status: number) {
    super(`HTTP_${status}`);
  }
}

async function apiFetch<T>(apiBase: string, path: string, init?: RequestInit) {
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
  method: "PATCH" | "POST",
  body: unknown,
) {
  const csrf = await apiFetch<{ token: string }>(apiBase, "/auth/csrf");
  return apiFetch<T>(apiBase, path, {
    body: JSON.stringify(body),
    headers: { "X-CSRF-Token": csrf.token },
    method,
  });
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusLabel(status: string): string {
  return (
    {
      ACCEPTED: "Aceptada",
      ACTIVE: "Vigente",
      DECLINED: "Rechazada",
      EXPIRED: "Vencida",
      PROMOTED: "Promovida",
      WITHDRAWN: "Desistida",
    }[status] ?? status
  );
}

function Confirmation({
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
      aria-labelledby="capacity-offer-confirmation-title"
      aria-modal="true"
      className="confirmation-dialog-shell"
      role="dialog"
    >
      <div className="confirmation-dialog-card">
        <h3 id="capacity-offer-confirmation-title">{title}</h3>
        <p>{description}</p>
        <div className="flow-actions">
          <button className="button button-secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button
            className="button button-primary"
            onClick={onConfirm}
            ref={confirm}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

export function FamilyAdmissionWorkspace({
  apiBase,
  applicationId: initialApplicationId,
  tenantId,
}: {
  apiBase: string;
  applicationId: string;
  tenantId: string;
}) {
  const [applicationId, setApplicationId] = useState(initialApplicationId);
  const [projection, setProjection] = useState<FamilyProjection | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmation, setConfirmation] = useState<
    "ACCEPT" | "DECLINE" | "WITHDRAW" | null
  >(null);

  async function load() {
    if (!applicationId) return;
    try {
      setProjection(
        await apiFetch<FamilyProjection>(
          apiBase,
          `/family/tenants/${tenantId}/applications/${applicationId}/admission-status`,
        ),
      );
      setError("");
    } catch {
      setError("No encontramos esta postulación o ya no está disponible.");
    }
  }

  async function perform(action: "ACCEPT" | "DECLINE" | "WITHDRAW") {
    try {
      const offer = projection?.offer;
      if (action === "WITHDRAW") {
        await mutate(
          apiBase,
          `/family/tenants/${tenantId}/applications/${applicationId}/withdraw`,
          "POST",
          { confirmed: true },
        );
        setNotice("Tu desistimiento quedó confirmado y guardado.");
      } else if (offer) {
        await mutate(
          apiBase,
          `/family/tenants/${tenantId}/offers/${offer.id}/${action === "ACCEPT" ? "accept" : "decline"}`,
          "POST",
          { expectedOfferVersionId: offer.current.id },
        );
        setNotice(
          action === "ACCEPT"
            ? "Tu aceptación expresa quedó registrada. Esto aún no equivale a matrícula ni pago."
            : "Rechazaste la oferta y la reserva quedó liberada.",
        );
      }
      setConfirmation(null);
      await load();
    } catch (requestError) {
      setConfirmation(null);
      setError(
        requestError instanceof ApiError && requestError.status === 409
          ? "La oferta cambió o venció. Actualiza la vista antes de continuar."
          : "No pudimos completar la acción. Inténtalo nuevamente.",
      );
    }
  }

  return (
    <div className="capacity-offer-workspace">
      <div className="lookup-bar">
        <label className="field">
          <span>Postulación</span>
          <input
            onChange={(event) => setApplicationId(event.target.value)}
            placeholder="Application ID sintético"
            value={applicationId}
          />
        </label>
        <button className="button button-primary" onClick={() => void load()}>
          Ver estado
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
      {projection?.waitlist ? (
        <section className="admission-state-panel">
          <div>
            <h3>Lista de espera</h3>
            <p>
              Ingreso registrado el {formatDate(projection.waitlist.enteredAt)}.
              La institución informará si puede emitir una oferta.
            </p>
          </div>
          <span className="badge">
            {statusLabel(projection.waitlist.state)}
          </span>
          <p className="privacy-note">
            Por privacidad, no mostramos una posición numérica, prioridades ni
            cupos exactos.
          </p>
        </section>
      ) : null}
      {projection?.offer ? (
        <section className="offer-decision-panel">
          <div className="offer-decision-heading">
            <div>
              <h3>Oferta de vacante</h3>
              <p>
                Origen:{" "}
                {projection.offer.origin === "WAITLIST"
                  ? "lista de espera"
                  : "decisión favorable"}
              </p>
            </div>
            <span className="badge">
              {statusLabel(projection.offer.current.lifecycle)}
            </span>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Vencimiento exacto</dt>
              <dd>{formatDate(projection.offer.current.expiresAt)}</dd>
            </div>
            <div>
              <dt>Vigencia</dt>
              <dd>Versión {projection.offer.current.versionNumber}</dd>
            </div>
          </dl>
          <p className="muted">
            Aceptar registra tu decisión expresa. No equivale por sí sola a
            matrícula, obligación ni pago.
          </p>
          {projection.offer.current.lifecycle === "ACCEPTED" ? (
            <p className="readiness-copy readiness-copy-ready">
              Oferta aceptada. La institución continuará con el próximo paso;
              esta aceptación no equivale a matrícula ni pago.
            </p>
          ) : null}
          {projection.offer.current.lifecycle === "ACTIVE" ? (
            <div className="flow-actions">
              <button
                className="button button-secondary"
                onClick={() => setConfirmation("DECLINE")}
              >
                Rechazar oferta
              </button>
              <button
                className="button button-primary"
                onClick={() => setConfirmation("ACCEPT")}
              >
                Aceptar oferta
              </button>
            </div>
          ) : null}
          <details className="offer-history">
            <summary>Ver historia segura</summary>
            <ol>
              {projection.offer.history.map((version) => (
                <li key={version.id}>
                  Versión {version.versionNumber}:{" "}
                  {statusLabel(version.lifecycle)} · vence{" "}
                  {formatDate(version.expiresAt)}
                </li>
              ))}
            </ol>
          </details>
        </section>
      ) : null}
      {projection && projection.applicationStatus === "SUBMITTED" ? (
        <section className="withdrawal-panel">
          <div>
            <h3>Desistir de la postulación</h3>
            <p>
              Esta acción cierra el caso, libera una reserva aplicable y
              conserva el historial. No inicia ningún handoff.
            </p>
          </div>
          <button
            className="button button-secondary"
            onClick={() => setConfirmation("WITHDRAW")}
          >
            Desistir
          </button>
        </section>
      ) : null}
      {projection?.withdrawal ? (
        <p className="readiness-copy readiness-copy-ready">
          Desistimiento confirmado el{" "}
          {formatDate(projection.withdrawal.confirmedAt)}.
        </p>
      ) : null}
      <Confirmation
        description={
          confirmation === "ACCEPT"
            ? "Registrarás una aceptación expresa sobre esta vigencia exacta."
            : confirmation === "DECLINE"
              ? "La oferta quedará rechazada y su reserva se liberará."
              : "La postulación quedará desistida, con historia preservada y sin handoff."
        }
        onCancel={() => setConfirmation(null)}
        onConfirm={() => confirmation && void perform(confirmation)}
        open={confirmation !== null}
        title={
          confirmation === "ACCEPT"
            ? "Confirmar aceptación"
            : confirmation === "DECLINE"
              ? "Confirmar rechazo"
              : "Confirmar desistimiento"
        }
      />
    </div>
  );
}

export function StaffCapacityOfferWorkspace({
  apiBase,
  tenantId,
}: {
  apiBase: string;
  tenantId: string;
}) {
  const [offeringId, setOfferingId] = useState("");
  const [offerings, setOfferings] = useState<ConfigurationOffering[]>([]);
  const [offeringsLoading, setOfferingsLoading] = useState(true);
  const [offeringsError, setOfferingsError] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [capacity, setCapacity] = useState<Capacity | null>(null);
  const [readiness, setReadiness] = useState<OfferingReadiness | null>(null);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [handoff, setHandoff] = useState<FunctionalHandoff | null>(null);
  const [newCapacity, setNewCapacity] = useState("0");
  const [reason, setReason] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [offeringAction, setOfferingAction] = useState<
    "CLOSE" | "PUBLISH" | null
  >(null);

  const loadOfferings = useCallback(async () => {
    setOfferingsLoading(true);
    try {
      const configuration = await apiFetch<{
        offerings: ConfigurationOffering[];
      }>(apiBase, `/admin/tenants/${tenantId}/configuration`);
      setOfferings(configuration.offerings);
      setOfferingsError("");
    } catch (requestError) {
      setOfferingsError(
        requestError instanceof ApiError && requestError.status === 403
          ? "Tu cuenta no tiene permiso para consultar las ofertas del tenant."
          : "No se pudieron cargar las ofertas del tenant.",
      );
    } finally {
      setOfferingsLoading(false);
    }
  }, [apiBase, tenantId]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadOfferings();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [loadOfferings]);

  async function loadCapacityAndWaitlist() {
    if (!offeringId) return;
    try {
      const readinessResult = await apiFetch<OfferingReadiness>(
        apiBase,
        `/admin/tenants/${tenantId}/offerings/${offeringId}/readiness`,
      );
      setReadiness(readinessResult);

      // The bootstrap administrator can manage capacity but does not receive
      // waitlist.read. Keep capacity/publication usable without widening that
      // role solely to satisfy an optional dashboard panel.
      try {
        const waitlistResult = await apiFetch<{ items: WaitlistEntry[] }>(
          apiBase,
          `/staff/tenants/${tenantId}/offerings/${offeringId}/waitlist`,
        );
        setWaitlist(waitlistResult.items);
      } catch (requestError) {
        if (
          requestError instanceof ApiError &&
          (requestError.status === 401 || requestError.status === 403)
        ) {
          setWaitlist([]);
        } else {
          throw requestError;
        }
      }

      if (readinessResult.capacityState === "CAPACITY_NOT_CONFIGURED") {
        setCapacity(null);
        setNewCapacity("0");
      } else {
        const capacityResult = await apiFetch<Capacity>(
          apiBase,
          `/staff/tenants/${tenantId}/offerings/${offeringId}/capacity`,
        );
        setCapacity(capacityResult);
        setNewCapacity(String(capacityResult.configuredCapacity));
      }
      setError("");
    } catch {
      setCapacity(null);
      setReadiness(null);
      setWaitlist([]);
      setError("No se pudo cargar capacidad y espera para esta oferta.");
    }
  }

  async function refreshWorkspace() {
    await loadOfferings();
    await loadCapacityAndWaitlist();
  }

  async function saveCapacity() {
    if (!offeringId) return;
    try {
      const value = Number(newCapacity);
      const result = capacity
        ? await mutate<Capacity>(
            apiBase,
            `/staff/tenants/${tenantId}/offerings/${offeringId}/capacity`,
            "PATCH",
            {
              configuredCapacity: value,
              expectedVersion: capacity.concurrencyVersion,
              reason,
            },
          )
        : await mutate<Capacity>(
            apiBase,
            `/staff/tenants/${tenantId}/offerings/${offeringId}/capacity`,
            "POST",
            { configuredCapacity: value },
          );
      setCapacity(result);
      setReason("");
      setNotice("Capacidad de Admisión guardada y auditada.");
      setError("");
      await loadCapacityAndWaitlist();
    } catch (requestError) {
      setError(
        requestError instanceof ApiError && requestError.status === 409
          ? "La capacidad cambió o el valor queda bajo las reservas vigentes. Actualiza antes de continuar."
          : "No se pudo guardar la capacidad.",
      );
    }
  }

  async function performOfferingLifecycle(action: "CLOSE" | "PUBLISH") {
    if (!readiness) return;
    try {
      await mutate(
        apiBase,
        `/admin/tenants/${tenantId}/offerings/${offeringId}/${action === "PUBLISH" ? "publish" : "close"}`,
        "POST",
        { expectedOfferingVersion: readiness.offeringVersion },
      );
      setOfferingAction(null);
      setNotice(
        action === "PUBLISH"
          ? "Offering publicada después de verificar capacidad explícita."
          : "Offering cerrada mediante transición explícita.",
      );
      await loadCapacityAndWaitlist();
    } catch (requestError) {
      setOfferingAction(null);
      setError(
        requestError instanceof ApiError && requestError.status === 409
          ? "La offering o su capacidad cambió. Actualiza la vista antes de continuar."
          : "No se pudo completar la transición de la offering.",
      );
    }
  }

  async function promote(entry: WaitlistEntry) {
    if (!capacity) return;
    try {
      await mutate(
        apiBase,
        `/staff/tenants/${tenantId}/waitlist/${entry.id}/promote`,
        "POST",
        {
          expectedCapacityVersion: capacity.concurrencyVersion,
          expectedWaitlistEntryVersion: entry.concurrencyVersion,
        },
      );
      setNotice("La primera entrada fue promovida y recibió reserva/oferta.");
      await loadCapacityAndWaitlist();
    } catch (requestError) {
      setError(
        requestError instanceof ApiError && requestError.status === 409
          ? "La lista o el cupo cambió. La entrada permanece en espera; actualiza la vista."
          : "No se pudo promover la entrada.",
      );
    }
  }

  async function loadOffer() {
    if (!applicationId) return;
    try {
      setOffer(
        await apiFetch<Offer>(
          apiBase,
          `/staff/tenants/${tenantId}/applications/${applicationId}/admission-offer`,
        ),
      );
      setError("");
    } catch {
      setOffer(null);
      setError("No se encontró una oferta visible para ese caso.");
    }
  }

  async function reopen() {
    if (!offer || !capacity) return;
    try {
      setOffer(
        await mutate<Offer>(
          apiBase,
          `/staff/tenants/${tenantId}/offers/${offer.id}/reopen`,
          "POST",
          {
            expectedCapacityVersion: capacity.concurrencyVersion,
            expectedOfferVersionId: offer.current.id,
            reason: reopenReason,
          },
        ),
      );
      setReopenReason("");
      setNotice("Oferta reabierta con una nueva vigencia y reserva.");
      await loadCapacityAndWaitlist();
    } catch (requestError) {
      setError(
        requestError instanceof ApiError && requestError.status === 409
          ? "La oferta o capacidad cambió. Actualiza antes de reabrir."
          : "No se pudo reabrir la oferta.",
      );
    }
  }

  async function requestHandoff() {
    if (!offer) return;
    try {
      const result = await mutate<FunctionalHandoff>(
        apiBase,
        `/staff/tenants/${tenantId}/applications/${applicationId}/handoff`,
        "POST",
        {},
      );
      setHandoff(result);
      setNotice(
        "Handoff solicitado. Este estado no confirma matrícula ni pago.",
      );
      setError("");
    } catch (requestError) {
      setError(
        requestError instanceof ApiError && requestError.status === 409
          ? "El handoff sólo se habilita después de una aceptación expresa vigente."
          : "No se pudo registrar el handoff funcional.",
      );
    }
  }

  return (
    <div className="capacity-offer-workspace">
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
      <section className="capacity-console">
        <div className="section-heading">
          <div>
            <h3>Cupos y reservas</h3>
            <p className="muted">
              Capacidad interna de Admisión, separada de matrícula y EduPay.
            </p>
          </div>
          <button
            className="button button-secondary"
            onClick={() => void refreshWorkspace()}
          >
            Actualizar
          </button>
        </div>
        <label className="field">
          <span>Oferta sintética</span>
          <select
            disabled={offeringsLoading}
            onChange={(event) => {
              setOfferingId(event.target.value);
              setCapacity(null);
              setReadiness(null);
              setWaitlist([]);
              setError("");
            }}
            value={offeringId}
          >
            <option value="">
              {offeringsLoading ? "Cargando ofertas..." : "Seleccionar oferta"}
            </option>
            {offerings.map((offering) => (
              <option key={offering.id} value={offering.id}>
                {offering.code} · {offering.title} · {offering.status}
              </option>
            ))}
          </select>
        </label>
        {offeringsError ? (
          <p className="alert alert-error" role="alert">
            {offeringsError}
          </p>
        ) : null}
        {!offeringsLoading && !offeringsError && offerings.length === 0 ? (
          <p className="muted">No hay ofertas configuradas para este tenant.</p>
        ) : null}
        {readiness ? (
          <div className="offering-readiness-panel">
            <div>
              <span
                className={
                  readiness.capacityState === "CAPACITY_NOT_CONFIGURED"
                    ? "badge badge-warning"
                    : "badge badge-ready"
                }
              >
                {readiness.capacityState === "CAPACITY_NOT_CONFIGURED"
                  ? "Sin capacidad configurada"
                  : readiness.capacityState === "CAPACITY_CONFIGURED_ZERO"
                    ? "Capacidad configurada: 0"
                    : "Capacidad configurada"}
              </span>
              <p className="muted">
                Lifecycle {readiness.lifecycle} · versión{" "}
                {readiness.offeringVersion}
              </p>
            </div>
            <div className="flow-actions">
              {readiness.lifecycle === "DRAFT" ? (
                <button
                  className="button button-primary"
                  disabled={!readiness.publishable}
                  onClick={() => setOfferingAction("PUBLISH")}
                >
                  Publicar
                </button>
              ) : null}
              {readiness.lifecycle !== "CLOSED" ? (
                <button
                  className="button button-secondary"
                  onClick={() => setOfferingAction("CLOSE")}
                >
                  Cerrar offering
                </button>
              ) : null}
            </div>
            {readiness.blockers.length ? (
              <p
                className="readiness-copy readiness-copy-blocked"
                role="status"
              >
                Configura una capacidad explícita; 0 es válido si esa es la
                decisión institucional.
              </p>
            ) : null}
          </div>
        ) : null}
        {capacity ? (
          <dl className="capacity-measures">
            <div>
              <dt>Configurado</dt>
              <dd>{capacity.configuredCapacity}</dd>
            </div>
            <div>
              <dt>Comprometido</dt>
              <dd>{capacity.consumedCount}</dd>
            </div>
            <div>
              <dt>Disponible</dt>
              <dd>{capacity.availableCount}</dd>
            </div>
          </dl>
        ) : null}
        <div className="capacity-edit-row">
          <label className="field">
            <span>Nuevo cupo</span>
            <input
              min="0"
              onChange={(event) => setNewCapacity(event.target.value)}
              type="number"
              value={newCapacity}
            />
          </label>
          {capacity ? (
            <label className="field">
              <span>Motivo del ajuste</span>
              <input
                onChange={(event) => setReason(event.target.value)}
                value={reason}
              />
            </label>
          ) : null}
          <button
            className="button button-primary"
            disabled={capacity !== null && !reason.trim()}
            onClick={() => void saveCapacity()}
          >
            {capacity ? "Guardar ajuste" : "Crear capacidad"}
          </button>
        </div>
      </section>
      <section className="waitlist-console">
        <h3>Lista de espera</h3>
        {waitlist.length === 0 ? (
          <p className="empty-state">
            No hay entradas visibles en este alcance.
          </p>
        ) : (
          <ol className="waitlist-table">
            {waitlist.map((entry) => (
              <li key={entry.id}>
                <div>
                  <strong>
                    {entry.state === "ACTIVE"
                      ? `Posición interna ${entry.internalPosition}`
                      : statusLabel(entry.state)}
                  </strong>
                  <span>{entry.applicationId}</span>
                  <small>Ingreso {formatDate(entry.enteredAt)}</small>
                </div>
                {entry.state === "ACTIVE" ? (
                  <button
                    className="button button-primary"
                    disabled={entry.internalPosition !== 1 || !capacity}
                    onClick={() => void promote(entry)}
                  >
                    Promover primera entrada
                  </button>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>
      <section className="offer-console">
        <div className="lookup-bar">
          <label className="field">
            <span>Application ID sintético</span>
            <input
              onChange={(event) => setApplicationId(event.target.value)}
              value={applicationId}
            />
          </label>
          <button
            className="button button-secondary"
            onClick={() => void loadOffer()}
          >
            Cargar oferta
          </button>
        </div>
        {offer ? (
          <div className="offer-admin-detail">
            <div>
              <h3>Oferta {statusLabel(offer.current.lifecycle)}</h3>
              <p>
                {offer.origin} · vence {formatDate(offer.current.expiresAt)} ·
                versión {offer.current.versionNumber}
              </p>
            </div>
            {offer.current.lifecycle === "EXPIRED" ? (
              <div className="reopen-row">
                <label className="field">
                  <span>Motivo obligatorio de reapertura</span>
                  <input
                    onChange={(event) => setReopenReason(event.target.value)}
                    value={reopenReason}
                  />
                </label>
                <button
                  className="button button-primary"
                  disabled={!reopenReason.trim() || !capacity}
                  onClick={() => void reopen()}
                >
                  Reabrir con nueva vigencia
                </button>
              </div>
            ) : null}
            {offer.current.lifecycle === "ACCEPTED" ? (
              <div className="reopen-row">
                <div>
                  <strong>Frontera funcional</strong>
                  <p className="muted">
                    Sólo registra la solicitud local de Admisión; no crea
                    matrícula, obligación ni pago.
                  </p>
                </div>
                <button
                  className="button button-primary"
                  onClick={() => void requestHandoff()}
                >
                  Registrar handoff funcional
                </button>
              </div>
            ) : null}
            {handoff ? (
              <p
                aria-live="polite"
                className="readiness-copy readiness-copy-ready"
              >
                Handoff solicitado. Este estado no confirma matrícula ni pago.
              </p>
            ) : null}
            <details className="offer-history">
              <summary>Historia de vigencias</summary>
              <ol>
                {offer.history.map((version) => (
                  <li key={version.id}>
                    V{version.versionNumber} · {statusLabel(version.lifecycle)}{" "}
                    · {formatDate(version.expiresAt)}
                  </li>
                ))}
              </ol>
            </details>
          </div>
        ) : null}
      </section>
      <Confirmation
        description={
          offeringAction === "PUBLISH"
            ? `Se publicará la versión ${readiness?.offeringVersion ?? "actual"}. Estado de capacidad: ${readiness?.capacityState ?? "no disponible"}.`
            : "La offering dejará de admitir nuevas postulaciones. El historial se conserva."
        }
        onCancel={() => setOfferingAction(null)}
        onConfirm={() =>
          offeringAction && void performOfferingLifecycle(offeringAction)
        }
        open={offeringAction !== null}
        title={
          offeringAction === "PUBLISH"
            ? "Confirmar publicación"
            : "Confirmar cierre"
        }
      />
    </div>
  );
}
