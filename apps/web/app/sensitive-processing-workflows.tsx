"use client";

import { useCallback, useEffect, useState } from "react";

interface EffectivePolicy {
  activatedAt: string | null;
  activatedBy: string | null;
  category:
    | "ORDINARY_ADMISSION"
    | "SUPPORT_ACCOMMODATION"
    | "PIE_NEE_DIAGNOSTIC"
    | "HEALTH";
  configurable: boolean;
  enabled: boolean;
  explanation: string;
  label: string;
  purpose: string | null;
}

interface EffectivePoliciesResponse {
  items: EffectivePolicy[];
}

export function AdminSensitiveProcessingWorkspace({
  apiBase,
  tenantId,
}: {
  apiBase: string;
  tenantId: string;
}) {
  const [policies, setPolicies] = useState<EffectivePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingCategory, setSavingCategory] = useState<string | null>(null);
  const [purposeInputs, setPurposeInputs] = useState<Record<string, string>>(
    {},
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchPolicies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${apiBase}/admin/tenants/${tenantId}/sensitive-processing`,
        { credentials: "include" },
      );
      if (!res.ok) {
        throw new Error(
          `Error ${res.status}: No autorizado o institución no encontrada`,
        );
      }
      const data = (await res.json()) as EffectivePoliciesResponse;
      setPolicies(data.items);
      const initialPurposes: Record<string, string> = {};
      for (const p of data.items) {
        if (p.purpose) initialPurposes[p.category] = p.purpose;
      }
      setPurposeInputs(initialPurposes);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al cargar políticas",
      );
    } finally {
      setLoading(false);
    }
  }, [apiBase, tenantId]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void fetchPolicies();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [fetchPolicies]);

  async function handleToggle(category: string, currentEnabled: boolean) {
    setSavingCategory(category);
    setError(null);
    setSuccessMessage(null);
    try {
      const csrfRes = await fetch(`${apiBase}/auth/csrf`, {
        credentials: "include",
      });
      const csrfData = (await csrfRes.json()) as { token: string };

      const newEnabled = !currentEnabled;
      const purpose = newEnabled
        ? purposeInputs[category] || "Habilitación administrativa institucional"
        : null;

      const res = await fetch(
        `${apiBase}/admin/tenants/${tenantId}/sensitive-processing/policy`,
        {
          body: JSON.stringify({
            category,
            enabled: newEnabled,
            purpose,
          }),
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfData.token,
          },
          method: "POST",
        },
      );

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(
          body.message ||
            `No se pudo actualizar el tratamiento de ${category} (HTTP ${res.status})`,
        );
      }

      setSuccessMessage(
        `Tratamiento de ${category} ${newEnabled ? "habilitado" : "deshabilitado"} exitosamente.`,
      );
      await fetchPolicies();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al guardar política",
      );
    } finally {
      setSavingCategory(null);
    }
  }

  return (
    <div className="workspace-panel">
      <div className="panel-header">
        <div>
          <h3>Políticas de Tratamiento de Datos Sensibles (G5-PC1-R4)</h3>
          <p className="muted">
            Control de fail-closed y autorización explícita para captura y
            tratamiento de datos de salud y diagnósticos PIE/NEE.
          </p>
        </div>
        <button
          className="button button-outline"
          disabled={loading}
          onClick={fetchPolicies}
          type="button"
        >
          Actualizar
        </button>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success" role="status">
          {successMessage}
        </div>
      )}

      <div
        className="info-banner"
        style={{
          margin: "1rem 0",
          padding: "0.75rem",
          background: "var(--surface-subtle, #f5f5f5)",
          borderRadius: "4px",
        }}
      >
        <strong>Principio de protección y cierre por defecto:</strong>
        <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.875rem" }}>
          La verificación de autoridad del postulante no sustituye la
          habilitación institucional de tratamiento. Los formularios y
          requisitos documentales que soliciten datos de salud o diagnósticos
          PIE fallarán al publicarse a menos que la institución haya habilitado
          explícitamente la categoría correspondiente con propósito justificado.
        </p>
      </div>

      {loading ? (
        <p className="muted">Cargando políticas de tratamiento sensible...</p>
      ) : (
        <div
          className="stack-list"
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          {policies.map((p) => {
            const isSaving = savingCategory === p.category;
            return (
              <article
                className="policy-card"
                key={p.category}
                style={{
                  border: "1px solid var(--border-color, #ddd)",
                  borderRadius: "6px",
                  padding: "1rem",
                  background: p.enabled
                    ? "var(--surface, #fff)"
                    : "var(--surface-disabled, #fafafa)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <h4 style={{ margin: 0 }}>{p.label || p.category}</h4>
                      <span
                        className={`badge ${p.enabled ? "badge-open" : "badge-draft"}`}
                        style={{
                          padding: "0.15rem 0.5rem",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          fontWeight: "bold",
                        }}
                      >
                        {p.enabled
                          ? "HABILITADO"
                          : "DESHABILITADO (FAIL-CLOSED)"}
                      </span>
                    </div>
                    <p
                      className="muted"
                      style={{
                        margin: "0.25rem 0 0.5rem 0",
                        fontSize: "0.85rem",
                      }}
                    >
                      Código canónico: <code>{p.category}</code>
                    </p>
                    <p style={{ margin: 0, fontSize: "0.9rem" }}>
                      {p.explanation}
                    </p>
                    {p.purpose && (
                      <p
                        className="muted"
                        style={{ margin: "0.5rem 0 0 0", fontSize: "0.85rem" }}
                      >
                        <strong>Propósito registrado:</strong> {p.purpose}
                      </p>
                    )}
                    {p.activatedAt && (
                      <p
                        className="muted"
                        style={{ margin: "0.25rem 0 0 0", fontSize: "0.75rem" }}
                      >
                        Activado el: {new Date(p.activatedAt).toLocaleString()}
                      </p>
                    )}
                  </div>

                  {p.configurable && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-end",
                        gap: "0.5rem",
                      }}
                    >
                      {!p.enabled && (
                        <input
                          disabled={isSaving}
                          onChange={(e) =>
                            setPurposeInputs((prev) => ({
                              ...prev,
                              [p.category]: e.target.value,
                            }))
                          }
                          placeholder="Propósito / Justificación institucional"
                          style={{
                            fontSize: "0.85rem",
                            minWidth: "220px",
                            padding: "0.35rem 0.5rem",
                          }}
                          type="text"
                          value={purposeInputs[p.category] ?? ""}
                        />
                      )}
                      <button
                        className={`button ${p.enabled ? "button-outline" : "button-primary"}`}
                        disabled={isSaving}
                        onClick={() => handleToggle(p.category, p.enabled)}
                        type="button"
                      >
                        {isSaving
                          ? "Guardando..."
                          : p.enabled
                            ? "Deshabilitar"
                            : "Habilitar tratamiento"}
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
