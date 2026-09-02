"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type ActivityStatus =
  | "PENDIENTE"
  | "PROGRAMADA"
  | "REALIZADA"
  | "REPROGRAMADA"
  | "INASISTENCIA"
  | "EXENTA"
  | "NO_COMPLETADA"
  | "CERRADA";

interface FamilyActivity {
  activityId: string;
  appointment: {
    durationMinutes: number;
    id: string;
    location: string;
    scheduledStartAt: string;
    status: string;
  } | null;
  appointmentHistory: Array<{
    durationMinutes: number;
    id: string;
    location: string;
    scheduledStartAt: string;
    status: string;
  }>;
  instructions: string | null;
  kind: string;
  name: string;
  nextStep: string;
  required: boolean;
  reschedule: {
    normalReschedulesMade: number;
    normalReschedulesRemaining: number;
    pendingRequest: boolean;
  };
  status: ActivityStatus;
}

interface StaffActivity extends FamilyActivity {
  assignedUserId: string | null;
  attempts: Array<{
    id: string;
    noShowJustified: boolean | null;
    occurredAt: string;
    operationalOutcome: string;
    reason: string | null;
    sequence: number;
  }>;
  manualClosureEligible: boolean;
  rescheduleRequests: Array<{
    appointmentId: string;
    createdAt: string;
    id: string;
    reason: string;
    status: string;
  }>;
  results: Array<{
    attemptId: string;
    comment: string | null;
    createdAt: string;
    id: string;
    result: string;
    versionNumber: number;
  }>;
}

interface ActivityDefinition {
  code: string;
  id: string;
  kind: string;
  name: string;
  versions: Array<{
    durationMinutes: number;
    durationSource: "TENANT_KIND_DEFAULT" | "VERSION_OVERRIDE";
    id: string;
    lateToleranceMinutes: number;
    lifecycle: string;
    maxNormalReschedules: number;
    required: boolean;
    versionNumber: number;
  }>;
}

type ActivityKind = "GUARDIAN_INTERVIEW" | "DIAGNOSTIC_EVALUATION";

interface ActivityPolicy {
  backupMembershipId: string;
  concurrencyVersion: number;
  defaultDurationMinutes: number;
  id: string;
  kind: ActivityKind;
  primaryMembershipId: string;
  readinessBlockers: string[];
  ready: boolean;
}

interface EligibleActivityExecutor {
  membershipId: string;
  roleKeys: string[];
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
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  return (await response.json()) as T;
}

async function mutate<T>(
  apiBase: string,
  path: string,
  body: unknown,
  method: "PATCH" | "POST" | "PUT" = "POST",
): Promise<T> {
  const csrf = await apiFetch<{ token: string }>(apiBase, "/auth/csrf");
  return apiFetch<T>(apiBase, path, {
    body: JSON.stringify(body),
    headers: { "X-CSRF-Token": csrf.token },
    method,
  });
}

const statusLabel: Record<ActivityStatus, string> = {
  CERRADA: "Cerrada",
  EXENTA: "Exenta",
  INASISTENCIA: "Inasistencia",
  NO_COMPLETADA: "No completada",
  PENDIENTE: "Pendiente de programación",
  PROGRAMADA: "Programada",
  REALIZADA: "Realizada",
  REPROGRAMADA: "Reprogramada",
};

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function FamilyActivityWorkspace({
  apiBase,
  applicationId,
  tenantId,
}: {
  apiBase: string;
  applicationId: string;
  tenantId: string;
}) {
  const [activities, setActivities] = useState<FamilyActivity[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(applicationId));
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!applicationId) return;
    setLoading(true);
    try {
      setActivities(
        await apiFetch<FamilyActivity[]>(
          apiBase,
          `/family/tenants/${tenantId}/applications/${applicationId}/activities`,
        ),
      );
      setError("");
    } catch {
      setError("No se pudieron cargar las actividades de esta postulación.");
    } finally {
      setLoading(false);
    }
  }, [apiBase, applicationId, tenantId]);
  useEffect(() => {
    const handle = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(handle);
  }, [load]);

  async function requestChange(
    activityId: string,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const activity = activities.find((item) => item.activityId === activityId);
    if (activity?.appointment === null || activity?.appointment === undefined) {
      setError("La cita ya no está disponible; vuelve a cargar la actividad.");
      return;
    }
    const reason = String(
      new FormData(event.currentTarget).get("reason") ?? "",
    );
    try {
      await mutate(
        apiBase,
        `/family/tenants/${tenantId}/applications/${applicationId}/activities/${activityId}/appointments/${activity.appointment.id}/reschedule-requests`,
        { reason },
      );
      event.currentTarget.reset();
      setNotice("Solicitud enviada. El colegio asignará el nuevo horario.");
      await load();
    } catch {
      setError(
        "No se pudo enviar la solicitud. Revisa el motivo e inténtalo nuevamente.",
      );
    }
  }

  if (!applicationId)
    return (
      <p className="empty-state">
        Selecciona una postulación enviada para ver sus actividades.
      </p>
    );
  return (
    <div className="activity-workspace">
      <div className="section-heading">
        <div>
          <p className="eyebrow">SCR-FAM-012</p>
          <h2>Actividades y citas</h2>
        </div>
        <span className="badge">Fuente oficial del portal</span>
      </div>
      <p className="form-help">
        La familia ve el horario asignado y puede solicitar un cambio con
        motivo. No se muestran slots disponibles, evaluadores ni resultados
        internos.
      </p>
      {error ? (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="readiness-copy readiness-copy-ready" role="status">
          {notice}
        </p>
      ) : null}
      <div className="activity-list" aria-busy={loading}>
        {loading ? (
          <div
            aria-live="polite"
            className="empty-state empty-state-guided"
            role="status"
          >
            <strong>Cargando seguimiento…</strong>
            <span>Consultamos las actividades de esta postulación.</span>
          </div>
        ) : !error && activities.length === 0 ? (
          <div className="empty-state empty-state-guided">
            <strong>No hay actividades programadas</strong>
            <span>
              Vuelve a consultar más tarde. Esta pantalla no se actualiza
              periódicamente.
            </span>
          </div>
        ) : (
          activities.map((activity) => (
            <article className="activity-card" key={activity.activityId}>
              <div className="activity-card-heading">
                <div>
                  <span className="eyebrow">
                    {activity.required ? "Obligatoria" : "Configurada"}
                  </span>
                  <h3>{activity.name}</h3>
                </div>
                <span className="badge">{statusLabel[activity.status]}</span>
              </div>
              {activity.appointment ? (
                <dl className="detail-list">
                  <div>
                    <dt>Fecha y hora</dt>
                    <dd>{dateLabel(activity.appointment.scheduledStartAt)}</dd>
                  </div>
                  <div>
                    <dt>Duración</dt>
                    <dd>{activity.appointment.durationMinutes} minutos</dd>
                  </div>
                  <div>
                    <dt>Lugar</dt>
                    <dd>{activity.appointment.location}</dd>
                  </div>
                </dl>
              ) : null}
              {activity.instructions ? (
                <p className="form-help">
                  <strong>Preparación:</strong> {activity.instructions}
                </p>
              ) : null}
              <p className="form-help">{activity.nextStep}</p>
              {activity.appointment &&
              activity.status !== "CERRADA" &&
              !activity.reschedule.pendingRequest ? (
                <form
                  className="form-card"
                  onSubmit={(event) =>
                    void requestChange(activity.activityId, event)
                  }
                >
                  <label className="field">
                    <span>Motivo para solicitar cambio</span>
                    <textarea
                      name="reason"
                      required
                      aria-describedby={`reason-help-${activity.activityId}`}
                    />
                  </label>
                  <small id={`reason-help-${activity.activityId}`}>
                    El colegio asignará la nueva fecha y hora.
                  </small>
                  <button className="button button-secondary" type="submit">
                    Solicitar cambio
                  </button>
                </form>
              ) : null}
              {activity.reschedule.pendingRequest ? (
                <p className="readiness-copy readiness-copy-ready">
                  Solicitud de cambio pendiente de revisión.
                </p>
              ) : null}
            </article>
          ))
        )}
      </div>
    </div>
  );
}

export function StaffActivityWorkspace({
  apiBase,
  tenantId,
}: {
  apiBase: string;
  tenantId: string;
}) {
  const [applicationId, setApplicationId] = useState("");
  const [activities, setActivities] = useState<StaffActivity[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!applicationId) return;
    try {
      setActivities(
        await apiFetch<StaffActivity[]>(
          apiBase,
          `/staff/tenants/${tenantId}/applications/${applicationId}/activities`,
        ),
      );
      setError("");
    } catch {
      setError("No fue posible cargar la agenda para ese identificador.");
    }
  }, [apiBase, applicationId, tenantId]);

  async function run(activityId: string, path: string, body: unknown) {
    try {
      await mutate(
        apiBase,
        `/staff/tenants/${tenantId}/activities/${activityId}/${path}`,
        body,
      );
      setNotice("Acción registrada y auditada.");
      await load();
    } catch {
      setError("La acción fue denegada o la cita cambió. Recarga la agenda.");
    }
  }

  return (
    <div className="activity-workspace">
      <div className="section-heading">
        <div>
          <p className="eyebrow">SCR-STAFF-009 / 010</p>
          <h2>Agenda e intentos</h2>
        </div>
        <span className="badge badge-synthetic">Server-side</span>
      </div>
      <form
        className="lookup-bar"
        onSubmit={(event) => {
          event.preventDefault();
          void load();
        }}
      >
        <label className="field">
          <span>Application ID sintético</span>
          <input
            value={applicationId}
            onChange={(event) => setApplicationId(event.target.value)}
            required
          />
        </label>
        <button className="button button-primary" type="submit">
          Cargar agenda
        </button>
      </form>
      {error ? (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="readiness-copy readiness-copy-ready" role="status">
          {notice}
        </p>
      ) : null}
      <div className="activity-list">
        {activities.map((activity) => (
          <article className="activity-card" key={activity.activityId}>
            <div className="activity-card-heading">
              <h3>{activity.name}</h3>
              <span className="badge">{statusLabel[activity.status]}</span>
            </div>
            {activity.appointment ? (
              <p className="form-help">
                Cita actual: {dateLabel(activity.appointment.scheduledStartAt)}{" "}
                · {activity.appointment.location} · ejecutor asignado protegido
              </p>
            ) : (
              <p className="form-help">Sin cita actual.</p>
            )}
            <p className="form-help">
              Solicitudes pendientes:{" "}
              {
                activity.rescheduleRequests.filter(
                  (request) => request.status === "PENDING",
                ).length
              }{" "}
              · Inasistencias injustificadas:{" "}
              {
                activity.attempts.filter(
                  (attempt) =>
                    attempt.operationalOutcome === "INASISTENCIA" &&
                    attempt.noShowJustified === false,
                ).length
              }
            </p>
            <StaffActions activity={activity} onRun={run} />
          </article>
        ))}
      </div>
    </div>
  );
}

function StaffActions({
  activity,
  onRun,
}: {
  activity: StaffActivity;
  onRun: (activityId: string, path: string, body: unknown) => Promise<void>;
}) {
  const [assignedUserId, setAssignedUserId] = useState(
    activity.assignedUserId ?? "",
  );
  const [location, setLocation] = useState(
    activity.appointment?.location ?? "",
  );
  const [when, setWhen] = useState("");
  const appointmentId = activity.appointment?.id;
  return (
    <div className="activity-actions">
      <div className="activity-action-row">
        <label className="field">
          <span>Ejecutor</span>
          <input
            value={assignedUserId}
            onChange={(event) => setAssignedUserId(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Fecha/hora</span>
          <input
            type="datetime-local"
            value={when}
            onChange={(event) => setWhen(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Lugar</span>
          <input
            value={location}
            onChange={(event) => setLocation(event.target.value)}
          />
        </label>
      </div>
      {appointmentId ? (
        <>
          <button
            className="button button-secondary"
            onClick={() =>
              void onRun(activity.activityId, "reprogram", {
                assignedUserId,
                expectedAppointmentId: appointmentId,
                location,
                newScheduledStartAt: new Date(when).toISOString(),
                reason: "Solicitud operativa sintética",
              })
            }
            type="button"
          >
            Reprogramar
          </button>
          <button
            className="button button-secondary"
            onClick={() =>
              void onRun(activity.activityId, "record-no-show", {
                expectedAppointmentId: appointmentId,
                noShowJustified: false,
                occurredAt: new Date().toISOString(),
              })
            }
            type="button"
          >
            Registrar inasistencia
          </button>
          <button
            className="button button-secondary"
            onClick={() =>
              void onRun(activity.activityId, "record-not-completed", {
                expectedAppointmentId: appointmentId,
                occurredAt: new Date().toISOString(),
              })
            }
            type="button"
          >
            Registrar no completada
          </button>
        </>
      ) : (
        <button
          className="button button-primary"
          onClick={() =>
            void onRun(activity.activityId, "schedule", {
              assignedUserId,
              location,
              newScheduledStartAt: new Date(when).toISOString(),
            })
          }
          type="button"
        >
          Programar
        </button>
      )}
      <p className="form-help">
        Los botones aparecen como ayudas operativas; la API sigue exigiendo
        permiso, scope, CSRF y cita esperada.
      </p>
    </div>
  );
}

export function AdminActivityWorkspace({
  apiBase,
  tenantId,
}: {
  apiBase: string;
  tenantId: string;
}) {
  const [definitions, setDefinitions] = useState<ActivityDefinition[]>([]);
  const [policies, setPolicies] = useState<ActivityPolicy[]>([]);
  const [eligibleExecutors, setEligibleExecutors] = useState<
    EligibleActivityExecutor[]
  >([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    try {
      const [definitionsResult, policiesResult, executorsResult] =
        await Promise.all([
          apiFetch<{ items: ActivityDefinition[] }>(
            apiBase,
            `/admin/tenants/${tenantId}/activities`,
          ),
          apiFetch<{ items: ActivityPolicy[] }>(
            apiBase,
            `/admin/tenants/${tenantId}/activity-policies`,
          ),
          apiFetch<{ items: EligibleActivityExecutor[] }>(
            apiBase,
            `/admin/tenants/${tenantId}/activity-policy-executors`,
          ),
        ]);
      setDefinitions(definitionsResult.items);
      setPolicies(policiesResult.items);
      setEligibleExecutors(executorsResult.items);
      setError("");
    } catch {
      setError("No fue posible cargar la configuración de actividades.");
    }
  }, [apiBase, tenantId]);
  useEffect(() => {
    const handle = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(handle);
  }, [load]);
  async function createDefinition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await mutate(apiBase, `/admin/tenants/${tenantId}/activities`, {
        code: data.get("code"),
        kind: data.get("kind"),
        name: data.get("name"),
      });
      event.currentTarget.reset();
      await load();
    } catch {
      setError("No se pudo crear la definición.");
    }
  }
  async function createVersion(
    event: FormEvent<HTMLFormElement>,
    definitionId: string,
  ) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const durationMode = data.get("durationMode");
      const durationValue = Number(data.get("durationMinutes"));
      if (
        durationMode === "VERSION_OVERRIDE" &&
        (!Number.isInteger(durationValue) || durationValue < 1)
      ) {
        setError(
          "El override debe indicar una duración válida entre 1 y 1440.",
        );
        return;
      }
      await mutate(
        apiBase,
        `/admin/tenants/${tenantId}/activities/${definitionId}/versions`,
        {
          ...(durationMode === "VERSION_OVERRIDE"
            ? { durationMinutes: durationValue }
            : {}),
          lateToleranceMinutes: Number(data.get("lateToleranceMinutes")),
          maxNormalReschedules: Number(data.get("maxNormalReschedules")),
          required: data.get("required") === "on",
        },
      );
      event.currentTarget.reset();
      setNotice("Versión DRAFT creada con su duración resuelta y persistida.");
      await load();
    } catch {
      setError(
        "No se pudo crear la versión. Configura una policy ready o usa un override válido.",
      );
    }
  }

  async function savePolicy(
    event: FormEvent<HTMLFormElement>,
    kind: ActivityKind,
  ) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const current = policies.find((policy) => policy.kind === kind);
    const primaryMembershipId = String(data.get("primaryMembershipId") ?? "");
    const backupMembershipId = String(data.get("backupMembershipId") ?? "");
    if (!primaryMembershipId || !backupMembershipId) {
      setError("Selecciona primary y backup entre los ejecutores elegibles.");
      return;
    }
    if (primaryMembershipId === backupMembershipId) {
      setError("Primary y backup deben ser memberships distintas.");
      return;
    }
    try {
      await mutate(
        apiBase,
        `/admin/tenants/${tenantId}/activity-policies/${kind}`,
        {
          backupMembershipId,
          defaultDurationMinutes: Number(data.get("defaultDurationMinutes")),
          ...(current ? { expectedVersion: current.concurrencyVersion } : {}),
          primaryMembershipId,
        },
        "PUT",
      );
      setNotice(
        current
          ? "Policy actualizada. Las citas históricas no fueron reescritas."
          : "Policy creada y validada para el tenant actual.",
      );
      await load();
    } catch {
      setError(
        "No se pudo guardar la policy. Actualiza la vista y verifica ejecutores, permisos y versión.",
      );
    }
  }

  async function publishVersion(versionId: string) {
    try {
      await mutate(
        apiBase,
        `/admin/tenants/${tenantId}/activity-versions/${versionId}/publish`,
        {},
      );
      setNotice(
        "Versión publicada después de revalidar la policy institucional.",
      );
      await load();
    } catch {
      setError(
        "No se pudo publicar: revisa los blockers de la policy del tipo.",
      );
    }
  }
  return (
    <div className="activity-workspace">
      <div className="section-heading">
        <div>
          <p className="eyebrow">SCR-ADM-005</p>
          <h2>Configuración de actividades</h2>
        </div>
        <span className="badge">Versionada</span>
      </div>
      <p className="form-help">
        Cada tipo exige default institucional, primary y backup. Las versiones
        pueden conservar ese default o persistir un override explícito.
      </p>
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
      <section
        aria-labelledby="activity-policy-title"
        className="policy-console"
      >
        <div className="section-heading">
          <div>
            <h3 id="activity-policy-title">Policies de duración y ejecución</h3>
            <p className="muted">
              Valores iniciales editables: entrevista 30 min y diagnóstico 60
              min.
            </p>
          </div>
          <span className="badge">Tenant + tipo</span>
        </div>
        <div className="policy-grid">
          {(["GUARDIAN_INTERVIEW", "DIAGNOSTIC_EVALUATION"] as const).map(
            (kind) => {
              const current = policies.find((policy) => policy.kind === kind);
              return (
                <form
                  className="policy-card"
                  key={kind}
                  onSubmit={(event) => void savePolicy(event, kind)}
                >
                  <div className="activity-card-heading">
                    <div>
                      <h4>
                        {kind === "GUARDIAN_INTERVIEW"
                          ? "Entrevista del apoderado"
                          : "Evaluación diagnóstica"}
                      </h4>
                      <p className="code">
                        {current
                          ? `Versión ${current.concurrencyVersion}`
                          : "Sin configurar"}
                      </p>
                    </div>
                    <span
                      className={
                        current?.ready
                          ? "badge badge-ready"
                          : "badge badge-warning"
                      }
                    >
                      {current?.ready ? "Ready" : "Blocked"}
                    </span>
                  </div>
                  {current?.readinessBlockers.length ? (
                    <p
                      className="readiness-copy readiness-copy-blocked"
                      role="status"
                    >
                      {current.readinessBlockers.join(" · ")}
                    </p>
                  ) : null}
                  <label className="field">
                    <span>Duración default, minutos</span>
                    <input
                      defaultValue={
                        current?.defaultDurationMinutes ??
                        (kind === "GUARDIAN_INTERVIEW" ? 30 : 60)
                      }
                      key={`${kind}-${current?.concurrencyVersion ?? 0}-duration`}
                      max="1440"
                      min="1"
                      name="defaultDurationMinutes"
                      required
                      type="number"
                    />
                  </label>
                  <label className="field">
                    <span>Primary elegible</span>
                    <select
                      defaultValue={current?.primaryMembershipId ?? ""}
                      key={`${kind}-${current?.concurrencyVersion ?? 0}-primary`}
                      name="primaryMembershipId"
                      required
                    >
                      <option disabled value="">
                        Selecciona una membership
                      </option>
                      {eligibleExecutors.map((executor) => (
                        <option
                          key={executor.membershipId}
                          value={executor.membershipId}
                        >
                          {executor.roleKeys.join(", ") ||
                            "Ejecutor autorizado"}{" "}
                          · {executor.membershipId.slice(0, 8)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Backup elegible</span>
                    <select
                      defaultValue={current?.backupMembershipId ?? ""}
                      key={`${kind}-${current?.concurrencyVersion ?? 0}-backup`}
                      name="backupMembershipId"
                      required
                    >
                      <option disabled value="">
                        Selecciona otra membership
                      </option>
                      {eligibleExecutors.map((executor) => (
                        <option
                          key={executor.membershipId}
                          value={executor.membershipId}
                        >
                          {executor.roleKeys.join(", ") ||
                            "Ejecutor autorizado"}{" "}
                          · {executor.membershipId.slice(0, 8)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="button button-primary" type="submit">
                    {current ? "Actualizar policy" : "Crear policy"}
                  </button>
                </form>
              );
            },
          )}
        </div>
      </section>
      <form
        className="form-card"
        onSubmit={(event) => void createDefinition(event)}
      >
        <h3>Nueva definición</h3>
        <Field label="Código" name="code" />
        <Field label="Nombre visible" name="name" />
        <label className="field">
          <span>Tipo</span>
          <select defaultValue="GUARDIAN_INTERVIEW" name="kind">
            <option value="GUARDIAN_INTERVIEW">Entrevista del apoderado</option>
            <option value="DIAGNOSTIC_EVALUATION">
              Evaluación diagnóstica
            </option>
          </select>
        </label>
        <button className="button button-primary" type="submit">
          Crear definición
        </button>
      </form>
      <div className="activity-list">
        {definitions.map((definition) => (
          <article className="activity-card" key={definition.id}>
            <h3>{definition.name}</h3>
            <p className="code">
              {definition.code} · {definition.kind}
            </p>
            <form
              className="form-card"
              onSubmit={(event) => void createVersion(event, definition.id)}
            >
              <h4>Nueva versión</h4>
              <label className="field">
                <span>Fuente de duración</span>
                <select defaultValue="TENANT_KIND_DEFAULT" name="durationMode">
                  <option value="TENANT_KIND_DEFAULT">
                    Usar default institucional
                  </option>
                  <option value="VERSION_OVERRIDE">
                    Override para esta versión
                  </option>
                </select>
              </label>
              <label className="field">
                <span>Override en minutos, si corresponde</span>
                <input
                  max="1440"
                  min="1"
                  name="durationMinutes"
                  type="number"
                />
              </label>
              <label className="field">
                <span>Máximo de reprogramaciones normales</span>
                <input
                  defaultValue="2"
                  min="0"
                  name="maxNormalReschedules"
                  required
                  type="number"
                />
              </label>
              <label className="field">
                <span>Tolerancia para inasistencia, en minutos</span>
                <input
                  defaultValue="15"
                  min="0"
                  name="lateToleranceMinutes"
                  required
                  type="number"
                />
              </label>
              <label className="checkbox-row">
                <input name="required" type="checkbox" />
                <span>Obligatoria para el alcance configurado</span>
              </label>
              <button className="button button-secondary" type="submit">
                Crear versión DRAFT
              </button>
            </form>
            {definition.versions.map((version) => (
              <div className="version-row" key={version.id}>
                <span>
                  v{version.versionNumber} · {version.lifecycle} ·{" "}
                  {version.durationMinutes} min ({version.durationSource}) ·{" "}
                  {version.maxNormalReschedules} cambios ·{" "}
                  {version.lateToleranceMinutes} min tolerancia
                </span>
                {version.lifecycle === "DRAFT" ? (
                  <button
                    className="button button-secondary"
                    onClick={() => void publishVersion(version.id)}
                    type="button"
                  >
                    Publicar versión
                  </button>
                ) : null}
              </div>
            ))}
          </article>
        ))}
      </div>
    </div>
  );
}

function Field({ label, name }: { label: string; name: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input name={name} required />
    </label>
  );
}
