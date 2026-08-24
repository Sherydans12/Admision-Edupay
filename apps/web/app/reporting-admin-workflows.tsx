"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type LoadState =
  | "idle"
  | "loading"
  | "success"
  | "conflict"
  | "forbidden"
  | "validation"
  | "limit"
  | "failed";

interface ReportDefinition {
  allowedColumns: { key: string; label: string; sensitivity: string }[];
  allowedFilters: string[];
  defaultColumns: string[];
  key: string;
  label: string;
}

interface Assignment {
  endsAt: string | null;
  id: string;
  permissions: string[];
  roleKey: string;
  scopes: string[];
  startsAt: string;
  status: "ACTIVE" | "REVOKED" | "SUSPENDED";
  updatedAt: string;
}

interface MembershipAccess {
  assignments: Assignment[];
  id: string;
  status: string;
  userId: string;
}

interface AuditEvent {
  action: string;
  actorId: string;
  correlationId: string;
  effectiveActorId: string;
  id: string;
  occurredAt: string;
  purpose: string;
  resourceId: string | null;
  resourceType: string;
  result: string;
}

const STATUS_COPY: Record<LoadState, string> = {
  conflict:
    "El registro cambió mientras trabajabas. Actualiza y vuelve a intentar.",
  failed: "No fue posible completar la operación.",
  forbidden: "Tu acceso actual no permite esta operación.",
  idle: "Listo.",
  limit: "El resultado supera el máximo técnico. Reduce los filtros.",
  loading: "Procesando…",
  success: "Operación completada.",
  validation: "Revisa los valores ingresados.",
};

function responseState(status: number): LoadState {
  if (status === 400) return "validation";
  if (status === 401 || status === 403) return "forbidden";
  if (status === 409) return "conflict";
  return "failed";
}

async function getCsrf(apiBase: string): Promise<string> {
  const response = await fetch(`${apiBase}/auth/csrf`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error(String(response.status));
  return ((await response.json()) as { token: string }).token;
}

function StatusLine({ state }: { state: LoadState }) {
  return (
    <p aria-live="polite" className="muted" role="status">
      {STATUS_COPY[state]}
    </p>
  );
}

export function StaffReportsWorkspace({
  apiBase,
  tenantId,
}: {
  apiBase: string;
  tenantId: string;
}) {
  const [catalog, setCatalog] = useState<ReportDefinition[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [reportKey, setReportKey] = useState("");
  const [columns, setColumns] = useState<string[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const selected = useMemo(
    () => catalog.find((report) => report.key === reportKey),
    [catalog, reportKey],
  );

  const load = useCallback(async () => {
    setState("loading");
    try {
      const [accessResponse, catalogResponse] = await Promise.all([
        fetch(`${apiBase}/staff/tenants/${tenantId}/access/me`, {
          credentials: "include",
        }),
        fetch(`${apiBase}/staff/tenants/${tenantId}/reports`, {
          credentials: "include",
        }),
      ]);
      if (!accessResponse.ok || !catalogResponse.ok) {
        setState(
          responseState(
            Math.max(accessResponse.status, catalogResponse.status),
          ),
        );
        return;
      }
      const access = (await accessResponse.json()) as { permissions: string[] };
      const result = (await catalogResponse.json()) as {
        items: ReportDefinition[];
      };
      setPermissions(access.permissions);
      setCatalog(result.items);
      const first = result.items[0];
      setReportKey(first?.key ?? "");
      setColumns(first?.defaultColumns ?? []);
      setState("success");
    } catch {
      setState("failed");
    }
  }, [apiBase, tenantId]);

  useEffect(() => {
    const handle = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(handle);
  }, [load]);

  function chooseReport(key: string) {
    const report = catalog.find((item) => item.key === key);
    setReportKey(key);
    setColumns(report?.defaultColumns ?? []);
  }

  async function exportCsv(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setState("loading");
    const form = new FormData(event.currentTarget);
    const filters = Object.fromEntries(
      selected.allowedFilters
        .map(
          (key) =>
            [
              key,
              key === "dateFrom" || key === "dateTo"
                ? String(form.get(key) ?? "") === ""
                  ? ""
                  : new Date(String(form.get(key))).toISOString()
                : String(form.get(key) ?? "").trim(),
            ] as const,
        )
        .filter(([, value]) => value !== ""),
    );
    try {
      const csrf = await getCsrf(apiBase);
      const response = await fetch(
        `${apiBase}/staff/tenants/${tenantId}/reports/${selected.key}/export`,
        {
          body: JSON.stringify({ columns, filters }),
          credentials: "include",
          headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
          method: "POST",
        },
      );
      if (!response.ok) {
        setState(
          response.status === 409 ? "limit" : responseState(response.status),
        );
        return;
      }
      const blobUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      const disposition = response.headers.get("Content-Disposition") ?? "";
      link.download =
        /filename="([^"]+)"/u.exec(disposition)?.[1] ?? "reporte.csv";
      link.href = blobUrl;
      link.click();
      URL.revokeObjectURL(blobUrl);
      setState("success");
    } catch {
      setState("failed");
    }
  }

  return (
    <form className="form-card form-wide" onSubmit={exportCsv}>
      <h3>Exportar datos operativos</h3>
      <p className="muted">
        Elige un reporte, sus filtros y sólo las columnas necesarias. El archivo
        se genera en el momento y no queda almacenado.
      </p>
      <label className="field">
        <span>Reporte</span>
        <select
          value={reportKey}
          onChange={(event) => chooseReport(event.target.value)}
        >
          {catalog.map((report) => (
            <option key={report.key} value={report.key}>
              {report.label}
            </option>
          ))}
        </select>
      </label>
      {selected ? (
        <fieldset className="control-group">
          <legend>Columnas incluidas</legend>
          {selected.allowedColumns.map((column) => (
            <label className="choice-card" key={column.key}>
              <input
                checked={columns.includes(column.key)}
                onChange={(event) =>
                  setColumns((current) =>
                    event.target.checked
                      ? [...current, column.key]
                      : current.filter((key) => key !== column.key),
                  )
                }
                type="checkbox"
              />
              <span>{column.label}</span>
              <small>
                {column.sensitivity === "restricted"
                  ? "Dato restringido"
                  : "Uso interno"}
              </small>
            </label>
          ))}
        </fieldset>
      ) : null}
      {selected?.allowedFilters.length ? (
        <div className="split-grid">
          {selected.allowedFilters.map((filter) => (
            <label className="field" key={filter}>
              <span>{filter}</span>
              <input
                name={filter}
                type={
                  filter === "dateFrom" || filter === "dateTo"
                    ? "datetime-local"
                    : "text"
                }
              />
            </label>
          ))}
        </div>
      ) : null}
      {permissions.includes("report.export") ? (
        <button
          className="button button-primary"
          disabled={state === "loading" || columns.length === 0}
          type="submit"
        >
          Generar CSV
        </button>
      ) : (
        <p className="privacy-note">
          Puedes consultar el catálogo, pero tu rol no permite exportar.
        </p>
      )}
      <StatusLine state={state} />
    </form>
  );
}

export function AdminAccessWorkspace({
  apiBase,
  tenantId,
}: {
  apiBase: string;
  tenantId: string;
}) {
  const [memberships, setMemberships] = useState<MembershipAccess[]>([]);
  const [state, setState] = useState<LoadState>("loading");

  const load = useCallback(async () => {
    setState("loading");
    try {
      const response = await fetch(
        `${apiBase}/admin/tenants/${tenantId}/access`,
        { credentials: "include" },
      );
      if (!response.ok) return setState(responseState(response.status));
      setMemberships(
        ((await response.json()) as { items: MembershipAccess[] }).items,
      );
      setState("success");
    } catch {
      setState("failed");
    }
  }, [apiBase, tenantId]);
  useEffect(() => {
    const handle = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(handle);
  }, [load]);

  async function mutate(path: string, method: string, body: unknown) {
    setState("loading");
    try {
      const csrf = await getCsrf(apiBase);
      const response = await fetch(`${apiBase}${path}`, {
        body: JSON.stringify(body),
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        method,
      });
      if (!response.ok) return setState(responseState(response.status));
      await load();
    } catch {
      setState("failed");
    }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate(`/admin/tenants/${tenantId}/role-assignments`, "POST", {
      membershipId: form.get("membershipId"),
      permissions: String(form.get("permissions") ?? "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
      roleKey: form.get("roleKey"),
      scopes: String(form.get("scopes") ?? "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
      startsAt: new Date(String(form.get("startsAt"))).toISOString(),
    });
  }

  async function changeStatus(
    assignment: Assignment,
    status: "ACTIVE" | "SUSPENDED",
  ) {
    await mutate(
      `/admin/tenants/${tenantId}/role-assignments/${assignment.id}`,
      "PATCH",
      {
        expectedUpdatedAt: assignment.updatedAt,
        permissions: assignment.permissions,
        roleKey: assignment.roleKey,
        scopes: assignment.scopes,
        status,
      },
    );
  }

  async function revoke(assignment: Assignment) {
    await mutate(
      `/admin/tenants/${tenantId}/role-assignments/${assignment.id}/revoke`,
      "POST",
      {
        expectedUpdatedAt: assignment.updatedAt,
      },
    );
  }

  if (state === "forbidden") {
    return (
      <div className="privacy-note" role="status">
        No tienes permiso para consultar ni administrar asignaciones de acceso.
      </div>
    );
  }

  return (
    <div className="workflow-stack">
      <form className="form-card form-wide" onSubmit={create}>
        <h3>Asignar acceso acotado</h3>
        <p className="muted">
          Sólo puedes delegar permisos y alcances que ya posees.
        </p>
        <div className="split-grid">
          <label className="field">
            <span>Membresía</span>
            <select name="membershipId" required>
              {memberships.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.userId}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Descriptor de rol</span>
            <input name="roleKey" required />
          </label>
          <label className="field">
            <span>Permisos, separados por coma</span>
            <input
              name="permissions"
              placeholder="report.read, report.export"
              required
            />
          </label>
          <label className="field">
            <span>Alcances, separados por coma</span>
            <input name="scopes" placeholder="* o application:uuid" required />
          </label>
          <label className="field">
            <span>Inicio</span>
            <input name="startsAt" type="datetime-local" required />
          </label>
        </div>
        <button className="button button-primary" type="submit">
          Crear asignación
        </button>
      </form>
      <div className="form-card form-wide">
        <h3>Accesos vigentes</h3>
        <div className="table-shell">
          <table className="data-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol y alcance</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {memberships.flatMap((membership) =>
                membership.assignments.map((assignment) => (
                  <tr key={assignment.id}>
                    <td>{membership.userId}</td>
                    <td>
                      <strong>{assignment.roleKey}</strong>
                      <br />
                      <small>
                        {assignment.permissions.join(", ")} ·{" "}
                        {assignment.scopes.join(", ")}
                      </small>
                    </td>
                    <td>{assignment.status}</td>
                    <td className="table-actions">
                      {assignment.status !== "REVOKED" ? (
                        <>
                          <button
                            className="button button-secondary"
                            onClick={() =>
                              void changeStatus(
                                assignment,
                                assignment.status === "ACTIVE"
                                  ? "SUSPENDED"
                                  : "ACTIVE",
                              )
                            }
                            type="button"
                          >
                            {assignment.status === "ACTIVE"
                              ? "Suspender"
                              : "Reactivar"}
                          </button>
                          <button
                            className="button button-secondary"
                            onClick={() => void revoke(assignment)}
                            type="button"
                          >
                            Revocar
                          </button>
                        </>
                      ) : null}
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
        <StatusLine state={state} />
      </div>
    </div>
  );
}

export function AuditWorkspace({
  apiBase,
  tenantId,
}: {
  apiBase: string;
  tenantId: string;
}) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [state, setState] = useState<LoadState>("idle");
  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("loading");
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams({
      dateFrom: new Date(String(form.get("dateFrom"))).toISOString(),
      dateTo: new Date(String(form.get("dateTo"))).toISOString(),
      limit: "50",
    });
    for (const key of ["action", "purpose", "resourceType", "resourceId"]) {
      const value = String(form.get(key) ?? "").trim();
      if (value) params.set(key, value);
    }
    try {
      const response = await fetch(
        `${apiBase}/admin/tenants/${tenantId}/audit-events?${params}`,
        { credentials: "include" },
      );
      if (!response.ok) return setState(responseState(response.status));
      setEvents(((await response.json()) as { items: AuditEvent[] }).items);
      setState("success");
    } catch {
      setState("failed");
    }
  }
  if (state === "forbidden") {
    return (
      <div className="privacy-note" role="status">
        No tienes permiso para consultar la trazabilidad institucional.
      </div>
    );
  }
  return (
    <div className="workflow-stack">
      <form className="form-card form-wide" onSubmit={search}>
        <h3>Consultar trazabilidad</h3>
        <div className="split-grid">
          <label className="field">
            <span>Desde</span>
            <input name="dateFrom" required type="datetime-local" />
          </label>
          <label className="field">
            <span>Hasta</span>
            <input name="dateTo" required type="datetime-local" />
          </label>
          <label className="field">
            <span>Acción exacta</span>
            <input name="action" />
          </label>
          <label className="field">
            <span>Propósito</span>
            <input name="purpose" />
          </label>
          <label className="field">
            <span>Tipo de recurso</span>
            <input name="resourceType" />
          </label>
          <label className="field">
            <span>ID de recurso</span>
            <input name="resourceId" />
          </label>
        </div>
        <button className="button button-primary" type="submit">
          Consultar
        </button>
        <StatusLine state={state} />
      </form>
      <div className="table-shell">
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Acción</th>
              <th>Actor efectivo</th>
              <th>Recurso</th>
              <th>Resultado</th>
              <th>Correlación</th>
            </tr>
          </thead>
          <tbody>
            {events.map((item) => (
              <tr key={item.id}>
                <td>{new Date(item.occurredAt).toLocaleString("es-CL")}</td>
                <td>
                  {item.action}
                  <br />
                  <small>{item.purpose}</small>
                </td>
                <td>{item.effectiveActorId}</td>
                <td>
                  {item.resourceType}
                  <br />
                  <small>{item.resourceId ?? "—"}</small>
                </td>
                <td>{item.result}</td>
                <td>{item.correlationId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PlatformSupportWorkspace({
  apiBase,
  tenantId,
}: {
  apiBase: string;
  tenantId: string;
}) {
  const [active, setActive] = useState<{
    expiresAt: string;
    id: string;
    tenantId: string;
  } | null>(null);
  const [state, setState] = useState<LoadState>("idle");
  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("loading");
    const form = new FormData(event.currentTarget);
    try {
      const csrf = await getCsrf(apiBase);
      const response = await fetch(`${apiBase}/platform/support-elevations`, {
        body: JSON.stringify({
          categories: ["restricted"],
          expiresAt: new Date(String(form.get("expiresAt"))).toISOString(),
          purpose: "platform.support",
          reason: form.get("reason"),
          scopes: String(form.get("scopes") ?? "")
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean),
          targetTenantId: tenantId,
        }),
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        method: "POST",
      });
      if (!response.ok) return setState(responseState(response.status));
      setActive(
        (await response.json()) as {
          expiresAt: string;
          id: string;
          tenantId: string;
        },
      );
      setState("success");
    } catch {
      setState("failed");
    }
  }
  async function close() {
    if (!active) return;
    setState("loading");
    try {
      const csrf = await getCsrf(apiBase);
      const response = await fetch(
        `${apiBase}/platform/support-elevations/${active.id}/close`,
        {
          body: JSON.stringify({ targetTenantId: active.tenantId }),
          credentials: "include",
          headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
          method: "POST",
        },
      );
      if (!response.ok) return setState(responseState(response.status));
      setActive(null);
      setState("success");
    } catch {
      setState("failed");
    }
  }
  return (
    <form className="form-card form-wide" onSubmit={start}>
      <h3>Elevación temporal de soporte</h3>
      <p className="privacy-note">
        Una cuenta global no obtiene contenido institucional por defecto. La
        elevación queda acotada, expira y se audita.
      </p>
      <label className="field">
        <span>Motivo operativo</span>
        <textarea name="reason" required />
      </label>
      <label className="field">
        <span>Alcances exactos</span>
        <input name="scopes" placeholder="application:uuid" required />
      </label>
      <label className="field">
        <span>Expira</span>
        <input name="expiresAt" required type="datetime-local" />
      </label>
      {active ? (
        <div className="effect-card">
          <span>
            Elevación activa hasta{" "}
            {new Date(active.expiresAt).toLocaleString("es-CL")}
          </span>
          <br />
          <small>
            ID {active.id}. Úsalo como encabezado técnico en la solicitud
            institucional.
          </small>
          <br />
          <button
            className="button button-secondary"
            onClick={() => void close()}
            type="button"
          >
            Cerrar ahora
          </button>
        </div>
      ) : (
        <button className="button button-primary" type="submit">
          Iniciar elevación
        </button>
      )}
      <StatusLine state={state} />
    </form>
  );
}
