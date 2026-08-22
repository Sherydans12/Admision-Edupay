"use client";

import { useCallback, useEffect, useState } from "react";

interface TenantBusinessCalendar {
  concurrencyVersion: number;
  createdAt: string;
  id: string;
  tenantId: string;
  timezone: string;
  updatedAt: string;
}

interface BusinessCalendarExcludedDate {
  calendarDate: string; // YYYY-MM-DD
  createdAt: string;
  createdBy: string;
  id: string;
  reason: string;
  tenantId: string;
}

const COMMON_TIMEZONES = [
  "America/Santiago",
  "America/Punta_Arenas",
  "America/Easter",
  "America/Buenos_Aires",
  "America/Lima",
  "America/Bogota",
  "America/Mexico_City",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/Madrid",
  "UTC",
];

export function AdminBusinessCalendarWorkspace({
  apiBase,
  tenantId,
}: {
  apiBase: string;
  tenantId: string;
}) {
  const [calendar, setCalendar] = useState<TenantBusinessCalendar | null>(null);
  const [excludedDates, setExcludedDates] = useState<
    BusinessCalendarExcludedDate[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form states
  const [selectedTimezone, setSelectedTimezone] = useState("America/Santiago");
  const [customTimezone, setCustomTimezone] = useState("");
  const [savingCalendar, setSavingCalendar] = useState(false);

  const [newDateStr, setNewDateStr] = useState("");
  const [newReason, setNewReason] = useState("");
  const [addingDate, setAddingDate] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [calRes, datesRes] = await Promise.all([
        fetch(`${apiBase}/admin/tenants/${tenantId}/business-calendar`, {
          credentials: "include",
        }),
        fetch(
          `${apiBase}/admin/tenants/${tenantId}/business-calendar/excluded-dates`,
          { credentials: "include" },
        ),
      ]);

      if (!calRes.ok) {
        throw new Error(
          `Error ${calRes.status}: No autorizado o no se pudo consultar el calendario`,
        );
      }
      const calData = (await calRes.json()) as {
        item: TenantBusinessCalendar | null;
      };
      setCalendar(calData.item);
      if (calData.item) {
        if (COMMON_TIMEZONES.includes(calData.item.timezone)) {
          setSelectedTimezone(calData.item.timezone);
          setCustomTimezone("");
        } else {
          setSelectedTimezone("custom");
          setCustomTimezone(calData.item.timezone);
        }
      }

      if (datesRes.ok) {
        const datesData = (await datesRes.json()) as {
          items: BusinessCalendarExcludedDate[];
        };
        setExcludedDates(datesData.items);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Error al cargar configuración de calendario",
      );
    } finally {
      setLoading(false);
    }
  }, [apiBase, tenantId]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void fetchData();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [fetchData]);

  async function getCsrfToken(): Promise<string> {
    const res = await fetch(`${apiBase}/auth/csrf`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error("No se pudo obtener token de seguridad");
    const data = (await res.json()) as { token: string };
    return data.token;
  }

  async function handleSaveCalendar(e: React.FormEvent) {
    e.preventDefault();
    setSavingCalendar(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const csrf = await getCsrfToken();
      const timezone =
        selectedTimezone === "custom"
          ? customTimezone.trim()
          : selectedTimezone;

      if (!timezone) {
        throw new Error("Debe seleccionar o ingresar una zona horaria IANA.");
      }

      const res = await fetch(
        `${apiBase}/admin/tenants/${tenantId}/business-calendar`,
        {
          body: JSON.stringify({
            expectedVersion: calendar?.concurrencyVersion,
            timezone,
          }),
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrf,
          },
          method: "POST",
        },
      );

      if (!res.ok) {
        const body = (await res.json()) as {
          code?: string;
          error?: string;
          message?: string;
        };
        if (body.code === "INVALID_BUSINESS_TIMEZONE") {
          throw new Error("Zona horaria IANA inválida.");
        }
        if (body.code === "BUSINESS_CALENDAR_VERSION_CHANGED") {
          throw new Error(
            "La configuración fue modificada por otro usuario. Recargue la página.",
          );
        }
        throw new Error(
          `Error ${res.status}: ${body.message ?? "No se pudo guardar el calendario"}`,
        );
      }

      const updated = (await res.json()) as TenantBusinessCalendar;
      setCalendar(updated);
      setSuccessMessage(
        "Zona horaria institucional actualizada correctamente.",
      );
      void fetchData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al guardar el calendario",
      );
    } finally {
      setSavingCalendar(false);
    }
  }

  async function handleAddExcludedDate(e: React.FormEvent) {
    e.preventDefault();
    setAddingDate(true);
    setError(null);
    setSuccessMessage(null);
    try {
      if (!newDateStr || !newReason.trim()) {
        throw new Error("Debe especificar la fecha (YYYY-MM-DD) y el motivo.");
      }
      const csrf = await getCsrfToken();
      const res = await fetch(
        `${apiBase}/admin/tenants/${tenantId}/business-calendar/excluded-dates`,
        {
          body: JSON.stringify({
            calendarDate: newDateStr,
            reason: newReason.trim(),
          }),
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrf,
          },
          method: "POST",
        },
      );

      if (!res.ok) {
        const body = (await res.json()) as {
          code?: string;
          error?: string;
          message?: string;
        };
        if (body.code === "EXCLUDED_DATE_ALREADY_EXISTS") {
          throw new Error(
            "La fecha ya se encuentra configurada como excluida.",
          );
        }
        if (body.code === "BUSINESS_CALENDAR_NOT_CONFIGURED") {
          throw new Error(
            "Debe configurar primero la zona horaria del calendario institucional.",
          );
        }
        throw new Error(
          `Error ${res.status}: ${body.message ?? "No se pudo agregar la fecha excluida"}`,
        );
      }

      setNewDateStr("");
      setNewReason("");
      setSuccessMessage("Fecha no hábil agregada correctamente.");
      void fetchData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al agregar fecha excluida",
      );
    } finally {
      setAddingDate(false);
    }
  }

  async function handleRemoveExcludedDate(id: string) {
    setRemovingId(id);
    setError(null);
    setSuccessMessage(null);
    try {
      const csrf = await getCsrfToken();
      const res = await fetch(
        `${apiBase}/admin/tenants/${tenantId}/business-calendar/excluded-dates/${id}`,
        {
          credentials: "include",
          headers: {
            "x-csrf-token": csrf,
          },
          method: "DELETE",
        },
      );

      if (!res.ok) {
        throw new Error(`Error ${res.status}: No se pudo eliminar la fecha`);
      }

      setSuccessMessage("Fecha excluida eliminada.");
      void fetchData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al eliminar fecha excluida",
      );
    } finally {
      setRemovingId(null);
    }
  }

  if (loading) {
    return <div className="card">Cargando calendario institucional...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-lg font-semibold mb-2">
          Calendario Institucional y Plazos
        </h3>
        <p className="text-sm text-neutral-600 mb-4">
          Define la zona horaria oficial del establecimiento y los días no
          hábiles (feriados institucionales y legales). Los plazos de ofertas y
          subsanaciones se calculan en base a días hábiles (lunes a viernes no
          excluidos) y vencen a las 23:59:59.999 hora local.
        </p>

        <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800 mb-4">
          <strong>Regla de inmutabilidad:</strong> Los cambios en la zona
          horaria o fechas excluidas aplican exclusivamente a los nuevos plazos
          y recordatorios que se emitan a partir de la modificación. Las ofertas
          y plazos ya generados preservan sus fechas de vencimiento originales.
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded text-sm mb-4">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded text-sm mb-4">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSaveCalendar} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Zona Horaria IANA Institucional
            </label>
            <select
              className="w-full border rounded p-2 text-sm bg-white"
              value={selectedTimezone}
              onChange={(e) => setSelectedTimezone(e.target.value)}
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
              <option value="custom">Otra zona IANA (especificar)...</option>
            </select>
          </div>

          {selectedTimezone === "custom" && (
            <div>
              <label className="block text-sm font-medium mb-1">
                Identificador IANA Personalizado
              </label>
              <input
                type="text"
                className="w-full border rounded p-2 text-sm"
                placeholder="Ej. America/Sao_Paulo"
                value={customTimezone}
                onChange={(e) => setCustomTimezone(e.target.value)}
                required
              />
            </div>
          )}

          <div className="flex items-center gap-4 text-xs text-neutral-500">
            {calendar ? (
              <span>
                Configurado: v{calendar.concurrencyVersion} ({calendar.timezone}
                ) • Actualizado:{" "}
                {new Date(calendar.updatedAt).toLocaleString("es-CL")}
              </span>
            ) : (
              <span className="text-rose-600 font-medium">
                Sin configurar (las operaciones de oferta y subsanación
                requieren calendario activo)
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={savingCalendar}
            className="btn btn-primary text-sm"
          >
            {savingCalendar
              ? "Guardando..."
              : calendar
                ? "Actualizar Zona Horaria"
                : "Configurar Calendario"}
          </button>
        </form>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold mb-2">
          Días No Hábiles Excluidos (Feriados y Recesos)
        </h3>
        <p className="text-sm text-neutral-600 mb-4">
          Las fechas listadas a continuación no serán contabilizadas en el
          cómputo de los 3 días hábiles para ofertas ni en los plazos de
          subsanación.
        </p>

        <form
          onSubmit={handleAddExcludedDate}
          className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6 p-4 bg-neutral-50 rounded border"
        >
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">
              Fecha (YYYY-MM-DD)
            </label>
            <input
              type="date"
              className="w-full border rounded p-1.5 text-sm bg-white"
              value={newDateStr}
              onChange={(e) => setNewDateStr(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">
              Motivo / Feriado
            </label>
            <input
              type="text"
              className="w-full border rounded p-1.5 text-sm bg-white"
              placeholder="Ej. Fiestas Patrias, Receso invernal"
              maxLength={200}
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              required
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={addingDate}
              className="btn btn-secondary text-sm w-full"
            >
              {addingDate ? "Agregando..." : "Agregar Fecha No Hábil"}
            </button>
          </div>
        </form>

        {excludedDates.length === 0 ? (
          <p className="text-sm text-neutral-500 italic">
            No hay fechas no hábiles configuradas. Solo se excluirán sábados y
            domingos.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b bg-neutral-100 text-neutral-700">
                  <th className="p-2">Fecha</th>
                  <th className="p-2">Motivo</th>
                  <th className="p-2">Registrado</th>
                  <th className="p-2 text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {excludedDates.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-neutral-50">
                    <td className="p-2 font-mono font-medium">
                      {item.calendarDate}
                    </td>
                    <td className="p-2">{item.reason}</td>
                    <td className="p-2 text-xs text-neutral-500">
                      {new Date(item.createdAt).toLocaleDateString("es-CL")}
                    </td>
                    <td className="p-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemoveExcludedDate(item.id)}
                        disabled={removingId === item.id}
                        className="text-xs text-rose-600 hover:text-rose-800 font-medium disabled:opacity-50"
                      >
                        {removingId === item.id ? "Eliminando..." : "Eliminar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
