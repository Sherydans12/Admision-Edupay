"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DocumentReadinessSummary,
  FamilyDocumentWorkspace,
  type DocumentReadiness,
} from "./document-workflows";

type AnswerValue = boolean | string;
type FormFieldType =
  "TEXT" | "TEXTAREA" | "SELECT" | "RADIO" | "BOOLEAN" | "DATE";
type Lifecycle = "DRAFT" | "PUBLISHED" | "ARCHIVED";

interface FormField {
  condition: {
    fieldId: string;
    operator: "EQUALS" | "NOT_EQUALS" | "IN";
    value: AnswerValue | AnswerValue[];
  } | null;
  helpText: string | null;
  id: string;
  key: string;
  label: string;
  options: { label: string; order: number; value: string }[];
  order: number;
  processingCategory?:
    | "ORDINARY_ADMISSION"
    | "SUPPORT_ACCOMMODATION"
    | "PIE_NEE_DIAGNOSTIC"
    | "HEALTH"
    | null;
  purpose: string;
  required: boolean;
  sensitivity: "internal" | "restricted" | "highly_restricted";
  type: FormFieldType;
  validation: { maxLength?: number; minLength?: number } | null;
}

interface FormSection {
  description: string | null;
  fields: FormField[];
  id: string;
  order: number;
  title: string;
}

interface FormVersion {
  archivedAt: string | null;
  formDefinitionId: string;
  id: string;
  lifecycle: Lifecycle;
  publishedAt: string | null;
  sections: FormSection[];
  versionNumber: number;
}

interface Definition {
  id: string;
  name: string;
  purpose: string;
  versions: Array<Omit<FormVersion, "formDefinitionId" | "sections">>;
}

interface Review {
  applicationId: string;
  missingRequired: { fieldId: string; label: string; sectionId: string }[];
  offering: {
    academicYear: string;
    campus: string;
    courseLevel: string;
    process: string;
    title: string;
  };
  sections: Array<{
    fields: Array<FormField & { applicable: boolean; value?: AnswerValue }>;
    id: string;
    title: string;
  }>;
  student: { familyName: string; givenName: string; id: string };
  warning: string;
}

interface OfferingOption {
  id: string;
  title: string;
  code: string;
}

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
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  return (await response.json()) as T;
}

async function mutation<T>(
  apiBase: string,
  path: string,
  method: string,
  body?: unknown,
): Promise<T> {
  const csrf = await request<{ token: string }>(apiBase, "/auth/csrf");
  return request<T>(apiBase, path, {
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: { "X-CSRF-Token": csrf.token },
    method,
  });
}

function isApplicable(
  field: FormField,
  answers: Record<string, AnswerValue>,
): boolean {
  if (field.condition === null) return true;
  const actual = answers[field.condition.fieldId];
  const expected = field.condition.value;
  if (field.condition.operator === "IN")
    return (
      actual !== undefined &&
      Array.isArray(expected) &&
      expected.includes(actual)
    );
  const matches = !Array.isArray(expected) && actual === expected;
  return field.condition.operator === "EQUALS" ? matches : !matches;
}

export function FamilyApplicationFlow({
  apiBase,
  applicationId,
  onExit,
  onSubmitted,
  tenantId,
}: {
  apiBase: string;
  applicationId: string;
  onExit: () => void;
  onSubmitted: () => Promise<void>;
  tenantId: string;
}) {
  const [data, setData] = useState<{
    answers: { fieldId: string; value: AnswerValue }[];
    effectivePolicies?: { category: string; enabled: boolean }[];
    form: FormVersion;
  } | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [step, setStep] = useState(0);
  const [review, setReview] = useState<Review | null>(null);
  const [message, setMessage] = useState("Cargando formulario…");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [documentReadiness, setDocumentReadiness] = useState<DocumentReadiness>(
    {
      blocked: 0,
      ready: false,
      totalApplicable: 0,
    },
  );
  const errorRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const basePath = `/family/tenants/${tenantId}/applications/${applicationId}`;

  const disabledCategories = useMemo(() => {
    const map = new Map(
      data?.effectivePolicies?.map((p) => [p.category, p.enabled]),
    );
    const set = new Set<string>();
    for (const [cat, enabled] of map.entries()) {
      if (!enabled) set.add(cat);
    }
    return set;
  }, [data]);

  const load = useCallback(async () => {
    setData(null);
    setAnswers({});
    setReview(null);
    setStep(0);
    setSubmitted(false);
    setError("");
    try {
      const result = await request<{
        answers: { fieldId: string; value: AnswerValue }[];
        effectivePolicies?: { category: string; enabled: boolean }[];
        form: FormVersion;
      }>(apiBase, `${basePath}/form`);
      setData(result);
      setAnswers(
        Object.fromEntries(
          result.answers.map((answer) => [answer.fieldId, answer.value]),
        ),
      );
      setMessage(
        "Borrador listo. El avance se guarda sólo cuando eliges guardar.",
      );
    } catch {
      setError(
        "No fue posible abrir este formulario. Puede corresponder a una postulación histórica sin formulario versionado.",
      );
    }
  }, [apiBase, basePath]);

  useEffect(() => {
    const handle = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(handle);
  }, [load]);

  const applicableSections = useMemo(
    () =>
      data?.form.sections.map((section) => ({
        ...section,
        fields: section.fields.filter((field) => isApplicable(field, answers)),
      })) ?? [],
    [answers, data],
  );
  const isDocuments = step === applicableSections.length;
  const isReview = step > applicableSections.length;
  const section = applicableSections[step];
  const progress =
    applicableSections.length === 0
      ? 0
      : Math.min(
          100,
          Math.round(
            ((isReview ? applicableSections.length + 1 : step) /
              (applicableSections.length + 1)) *
              100,
          ),
        );

  async function clearAnswer(fieldId: string) {
    setError("");
    try {
      await mutation(apiBase, `${basePath}/answers`, "PUT", {
        answers: [{ fieldId, value: null }],
      });
      setAnswers((current) => {
        const next = { ...current };
        delete next[fieldId];
        return next;
      });
      setMessage("Respuesta eliminada correctamente.");
    } catch {
      setError("No fue posible eliminar la respuesta guardada.");
      window.setTimeout(() => errorRef.current?.focus(), 0);
    }
  }

  async function persist(goToDocuments = false) {
    if (!data) return false;
    setError("");
    try {
      const operableFields = applicableSections
        .flatMap((item) => item.fields)
        .filter(
          (field) =>
            !field.processingCategory ||
            !disabledCategories.has(field.processingCategory),
        );
      const operableFieldIds = new Set(operableFields.map((field) => field.id));
      const payload = Object.entries(answers)
        .filter(([fieldId]) => operableFieldIds.has(fieldId))
        .map(([fieldId, value]) => ({ fieldId, value }));
      if (payload.length > 0)
        await mutation(apiBase, `${basePath}/answers`, "PUT", {
          answers: payload,
        });
      setMessage("Borrador guardado.");
      if (goToDocuments) {
        setStep(applicableSections.length);
      }
      return true;
    } catch {
      setError(
        "No se pudo guardar el borrador. Revisa los campos e inténtalo nuevamente.",
      );
      window.setTimeout(() => errorRef.current?.focus(), 0);
      return false;
    }
  }

  async function openReview() {
    setError("");
    try {
      const result = await request<Review>(apiBase, `${basePath}/review`);
      setReview(result);
      setStep(applicableSections.length + 1);
      if (result.missingRequired.length > 0) {
        setError(
          `Faltan ${result.missingRequired.length} campos obligatorios.`,
        );
        window.setTimeout(() => errorRef.current?.focus(), 0);
      }
    } catch {
      setError("No fue posible preparar la revisión final.");
    }
  }

  async function submit() {
    setSubmitting(true);
    setError("");
    try {
      await mutation(apiBase, `${basePath}/submit`, "POST");
      dialogRef.current?.close();
      setSubmitted(true);
      setMessage("Postulación enviada y registrada.");
      await onSubmitted();
    } catch {
      dialogRef.current?.close();
      setError(
        "No fue posible enviar. El borrador sigue disponible y no se creó un envío parcial.",
      );
      window.setTimeout(() => errorRef.current?.focus(), 0);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="submission-success" role="status">
        <span aria-hidden="true" className="success-mark">
          ✓
        </span>
        <div>
          <h2>Postulación enviada</h2>
          <p>
            Guardamos una copia inmutable del formulario y sus respuestas.
            Postular no garantiza vacante.
          </p>
        </div>
        <button className="button button-primary" onClick={onExit}>
          Volver a mis postulaciones
        </button>
      </div>
    );
  }

  return (
    <div className="form-flow">
      <div className="flow-header">
        <div>
          <h2>
            {isReview
              ? "Revisa antes de enviar"
              : isDocuments
                ? "Documentos de la postulación"
                : (section?.title ?? "Formulario de postulación")}
          </h2>
          <p className="muted">
            {isReview
              ? "Confirma que la información sea correcta."
              : isDocuments
                ? "Carga y revisa los documentos aplicables antes de enviar."
                : section?.description}
          </p>
        </div>
        <span className="badge">Versión {data?.form.versionNumber ?? "—"}</span>
      </div>
      <div className="progress-block" aria-label={`Avance ${progress}%`}>
        <div>
          <span>
            {isReview
              ? "Revisión"
              : isDocuments
                ? "Documentos"
                : `Sección ${Math.min(step + 1, applicableSections.length)} de ${applicableSections.length}`}
          </span>
          <strong>{progress}%</strong>
        </div>
        <progress max="100" value={progress}>
          {progress}%
        </progress>
      </div>
      <p aria-live="polite" className="form-help">
        {message}
      </p>
      {error ? (
        <div
          className="alert alert-error"
          ref={errorRef}
          role="alert"
          tabIndex={-1}
        >
          {error}
        </div>
      ) : null}
      {!data && !error ? (
        <p className="empty-state">Cargando contenido versionado…</p>
      ) : null}
      {data && !isReview && !isDocuments && section ? (
        <form
          className="dynamic-form"
          onSubmit={(event) => event.preventDefault()}
        >
          {section.fields.length === 0 ? (
            <p className="empty-state">
              Esta sección no tiene preguntas aplicables.
            </p>
          ) : null}
          {section.fields.map((field) => (
            <DynamicField
              disabledCategory={
                field.processingCategory
                  ? disabledCategories.has(field.processingCategory)
                  : false
              }
              key={field.id}
              field={field}
              value={answers[field.id]}
              onClear={() => void clearAnswer(field.id)}
              onChange={(value) =>
                setAnswers((current) => ({ ...current, [field.id]: value }))
              }
            />
          ))}
          <div className="flow-actions">
            <button
              className="button button-secondary"
              disabled={step === 0}
              onClick={() => setStep((value) => Math.max(0, value - 1))}
              type="button"
            >
              Atrás
            </button>
            <button
              className="button button-secondary"
              onClick={() => void persist()}
              type="button"
            >
              Guardar
            </button>
            <button
              className="button button-primary"
              onClick={() =>
                step + 1 >= applicableSections.length
                  ? void persist(true)
                  : setStep((value) => value + 1)
              }
              type="button"
            >
              {step + 1 >= applicableSections.length ? "Revisar" : "Continuar"}
            </button>
          </div>
          <button
            className="text-button"
            onClick={() =>
              void (async () => {
                if (await persist()) onExit();
              })()
            }
            type="button"
          >
            Guardar y salir
          </button>
        </form>
      ) : null}
      {data && isDocuments ? (
        <FamilyDocumentWorkspace
          apiBase={apiBase}
          applicationId={applicationId}
          onBack={() => setStep(Math.max(0, applicableSections.length - 1))}
          onContinue={() => void openReview()}
          onReadinessChange={setDocumentReadiness}
          tenantId={tenantId}
        />
      ) : null}
      {data && isReview ? (
        <div className="review-stack">
          {review?.missingRequired.length ? (
            <div className="missing-summary">
              <h3>Completa antes de enviar</h3>
              <ul>
                {review.missingRequired.map((item) => (
                  <li key={item.fieldId}>{item.label}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {review?.sections.map((reviewSection) => (
            <section className="review-section" key={reviewSection.id}>
              <h3>{reviewSection.title}</h3>
              <dl>
                {reviewSection.fields
                  .filter((field) => field.applicable)
                  .map((field) => (
                    <div key={field.id}>
                      <dt>{field.label}</dt>
                      <dd>{formatAnswer(field, field.value)}</dd>
                    </div>
                  ))}
              </dl>
            </section>
          ))}
          <DocumentReadinessSummary state={documentReadiness} />
          <p className="warning-copy">
            {review?.warning ?? "Postular no garantiza vacante."}
          </p>
          <div className="flow-actions">
            <button
              className="button button-secondary"
              onClick={() => setStep(applicableSections.length)}
              type="button"
            >
              Volver a documentos
            </button>
            <button
              className="button button-primary"
              disabled={
                !review ||
                review.missingRequired.length > 0 ||
                !documentReadiness.ready
              }
              onClick={() => dialogRef.current?.showModal()}
              type="button"
            >
              Enviar postulación
            </button>
          </div>
        </div>
      ) : null}
      <dialog className="confirmation-dialog" ref={dialogRef}>
        <h2>¿Enviar esta postulación?</h2>
        <p>
          Después del envío, esta versión y sus respuestas quedarán registradas
          como una copia inmutable.
        </p>
        <p className="warning-copy">Postular no garantiza vacante.</p>
        <div className="flow-actions">
          <button
            className="button button-secondary"
            onClick={() => dialogRef.current?.close()}
            type="button"
          >
            Volver a revisar
          </button>
          <button
            className="button button-primary"
            disabled={submitting}
            onClick={() => void submit()}
            type="button"
          >
            {submitting ? "Enviando…" : "Confirmar envío"}
          </button>
        </div>
      </dialog>
    </div>
  );
}

function DynamicField({
  disabledCategory = false,
  field,
  onClear,
  onChange,
  value,
}: {
  disabledCategory?: boolean;
  field: FormField;
  onClear?: () => void;
  onChange: (value: AnswerValue) => void;
  value: AnswerValue | undefined;
}) {
  const id = `field-${field.id}`;
  const hasStoredValue = value !== undefined && value !== null && value !== "";

  if (disabledCategory) {
    if (hasStoredValue) {
      return (
        <div
          className="dynamic-field field-blocked alert alert-warning"
          role="status"
        >
          <strong>{field.label}</strong>
          <p className="warning-copy">
            Esta información fue registrada anteriormente, pero esta categoría
            ya no está habilitada. Debes eliminar la respuesta guardada para
            continuar.
          </p>
          {onClear ? (
            <button
              className="button button-secondary"
              onClick={onClear}
              type="button"
            >
              Eliminar respuesta guardada
            </button>
          ) : null}
        </div>
      );
    }

    return (
      <div
        className="dynamic-field field-blocked alert alert-warning"
        role="status"
      >
        <strong>{field.label}</strong>
        <p className="muted">
          Captura no habilitada: el tratamiento de datos para la categoría{" "}
          <code>{field.processingCategory}</code> se encuentra actualmente
          deshabilitado por la institución.
        </p>
      </div>
    );
  }

  const required = field.required ? (
    <span aria-hidden="true" className="required-mark">
      {" "}
      *
    </span>
  ) : null;
  const help = field.helpText ? `${id}-help` : undefined;
  if (field.type === "RADIO")
    return (
      <fieldset aria-describedby={help} className="dynamic-field">
        <legend>
          {field.label}
          {required}
        </legend>
        {field.helpText ? <p id={help}>{field.helpText}</p> : null}
        <div className="choice-grid">
          {field.options.map((option) => (
            <label className="choice-card" key={option.value}>
              <input
                checked={value === option.value}
                name={id}
                onChange={() => onChange(option.value)}
                required={field.required}
                type="radio"
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  if (field.type === "BOOLEAN")
    return (
      <label className="choice-card dynamic-field">
        <input
          checked={value === true}
          onChange={(event) => onChange(event.target.checked)}
          type="checkbox"
        />
        <span>
          {field.label}
          {required}
          {field.helpText ? <small>{field.helpText}</small> : null}
        </span>
      </label>
    );
  return (
    <label className="field dynamic-field" htmlFor={id}>
      <span>
        {field.label}
        {required}
      </span>
      {field.helpText ? <small id={help}>{field.helpText}</small> : null}
      {field.type === "TEXTAREA" ? (
        <textarea
          aria-describedby={help}
          id={id}
          maxLength={field.validation?.maxLength}
          minLength={field.validation?.minLength}
          onChange={(event) => onChange(event.target.value)}
          required={field.required}
          value={typeof value === "string" ? value : ""}
        />
      ) : field.type === "SELECT" ? (
        <select
          aria-describedby={help}
          id={id}
          onChange={(event) => onChange(event.target.value)}
          required={field.required}
          value={typeof value === "string" ? value : ""}
        >
          <option value="">Seleccionar</option>
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          aria-describedby={help}
          id={id}
          maxLength={field.validation?.maxLength}
          minLength={field.validation?.minLength}
          onChange={(event) => onChange(event.target.value)}
          required={field.required}
          type={field.type === "DATE" ? "date" : "text"}
          value={typeof value === "string" ? value : ""}
        />
      )}
    </label>
  );
}

function formatAnswer(
  field: FormField,
  value: AnswerValue | undefined,
): string {
  if (value === undefined || value === "") return "Sin respuesta";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return field.options.find((option) => option.value === value)?.label ?? value;
}

export function AdminFormBuilder({
  apiBase,
  offerings,
  tenantId,
}: {
  apiBase: string;
  offerings: OfferingOption[];
  tenantId: string;
}) {
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [version, setVersion] = useState<FormVersion | null>(null);
  const [selectedDefinition, setSelectedDefinition] = useState("");
  const [notice, setNotice] = useState(
    "Crea o selecciona una definición para comenzar.",
  );
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);
  const [editingSection, setEditingSection] = useState<FormSection | null>(
    null,
  );
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [editingFieldSectionId, setEditingFieldSectionId] = useState("");
  const publishDialog = useRef<HTMLDialogElement>(null);
  const root = `/admin/tenants/${tenantId}`;

  const loadDefinitions = useCallback(async () => {
    setDefinitions([]);
    setSelectedDefinition("");
    setVersion(null);
    setEditingField(null);
    setEditingSection(null);
    try {
      const result = await request<{ items: Definition[] }>(
        apiBase,
        `${root}/forms`,
      );
      setDefinitions(result.items);
      setSelectedDefinition((current) => current || result.items[0]?.id || "");
    } catch {
      setError(
        "No fue posible cargar las definiciones. Se requiere form.read.",
      );
    }
  }, [apiBase, root]);
  useEffect(() => {
    const handle = window.setTimeout(() => void loadDefinitions(), 0);
    return () => window.clearTimeout(handle);
  }, [loadDefinitions]);

  async function reloadVersion(id = version?.id) {
    if (!id) return;
    setVersion(
      await request<FormVersion>(apiBase, `${root}/form-versions/${id}`),
    );
  }
  async function run(action: () => Promise<void>, success: string) {
    setError("");
    try {
      await action();
      setNotice(success);
    } catch (requestError) {
      setError(
        requestError instanceof Error && requestError.message === "HTTP_403"
          ? "Tu rol no autoriza esta acción."
          : "La acción no pudo completarse. Revisa los datos y el estado de la versión.",
      );
    }
  }
  async function createDefinition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await run(async () => {
      const created = await mutation<{ id: string }>(
        apiBase,
        `${root}/forms`,
        "POST",
        { name: data.get("name"), purpose: "admission_application" },
      );
      event.currentTarget.reset();
      await loadDefinitions();
      setSelectedDefinition(created.id);
    }, "Definición creada.");
  }
  async function createVersion(sourceVersionId?: string) {
    await run(async () => {
      const created = await mutation<FormVersion>(
        apiBase,
        `${root}/forms/${selectedDefinition}/versions`,
        "POST",
        sourceVersionId ? { sourceVersionId } : {},
      );
      setVersion(created);
      await loadDefinitions();
    }, "Nueva versión DRAFT creada.");
  }
  async function createSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!version) return;
    const data = new FormData(event.currentTarget);
    await run(async () => {
      await mutation(
        apiBase,
        `${root}/form-versions/${version.id}/sections`,
        "POST",
        {
          description: data.get("description") || null,
          order: version.sections.length + 1,
          title: data.get("title"),
        },
      );
      event.currentTarget.reset();
      await reloadVersion();
    }, "Sección agregada.");
  }
  async function updateSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingSection) return;
    const data = new FormData(event.currentTarget);
    await run(async () => {
      await mutation(
        apiBase,
        `${root}/form-sections/${editingSection.id}`,
        "PATCH",
        {
          description: data.get("description") || null,
          order: editingSection.order,
          title: data.get("title"),
        },
      );
      setEditingSection(null);
      await reloadVersion();
    }, "Sección actualizada.");
  }

  function fieldInput(data: FormData, order: number) {
    const type = String(data.get("type")) as FormFieldType;
    const rawOptions = String(data.get("options") ?? "").trim();
    const conditionFieldId = String(data.get("conditionFieldId") ?? "");
    const conditionOperator = String(data.get("conditionOperator")) as
      "EQUALS" | "NOT_EQUALS" | "IN";
    const rawConditionValue = String(data.get("conditionValue") ?? "");
    const conditionSource = version?.sections
      .flatMap((section) => section.fields)
      .find((field) => field.id === conditionFieldId);
    const normalizeConditionValue = (value: string): AnswerValue =>
      conditionSource?.type === "BOOLEAN"
        ? value.trim().toLowerCase() === "true"
        : value.trim();
    const conditionValue =
      conditionOperator === "IN"
        ? rawConditionValue
            .split(",")
            .filter(Boolean)
            .map(normalizeConditionValue)
        : normalizeConditionValue(rawConditionValue);
    const options = rawOptions
      ? rawOptions
          .split("\n")
          .filter(Boolean)
          .map((line, index) => {
            const [rawValue = "", ...label] = line.split("|");
            return {
              label: (label.join("|") || rawValue).trim(),
              order: index + 1,
              value: rawValue.trim(),
            };
          })
      : null;
    return {
      condition: conditionFieldId
        ? {
            fieldId: conditionFieldId,
            operator: conditionOperator,
            value: conditionValue,
          }
        : null,
      helpText: data.get("helpText") || null,
      key: data.get("key"),
      label: data.get("label"),
      options: type === "SELECT" || type === "RADIO" ? options : null,
      order,
      processingCategory: String(data.get("processingCategory") ?? "") || null,
      purpose: data.get("purpose"),
      required: data.get("required") === "on",
      sectionId: String(data.get("sectionId")),
      sensitivity: data.get("sensitivity"),
      type,
      validation: null,
    };
  }
  async function createField(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!version) return;
    const data = new FormData(event.currentTarget);
    const sectionId = String(data.get("sectionId"));
    const section = version.sections.find((item) => item.id === sectionId);
    await run(async () => {
      await mutation(
        apiBase,
        `${root}/form-versions/${version.id}/fields`,
        "POST",
        fieldInput(data, (section?.fields.length ?? 0) + 1),
      );
      event.currentTarget.reset();
      await reloadVersion();
    }, "Campo agregado.");
  }
  async function updateField(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingField) return;
    const data = new FormData(event.currentTarget);
    await run(async () => {
      await mutation(
        apiBase,
        `${root}/form-fields/${editingField.id}`,
        "PATCH",
        fieldInput(data, editingField.order),
      );
      setEditingField(null);
      await reloadVersion();
    }, "Campo actualizado.");
  }
  async function move(
    kind: "form-sections" | "form-fields",
    id: string,
    direction: "UP" | "DOWN",
  ) {
    await run(async () => {
      await mutation(apiBase, `${root}/${kind}/${id}/move`, "POST", {
        direction,
      });
      await reloadVersion();
    }, "Orden actualizado.");
  }
  async function publish() {
    if (!version) return;
    await run(async () => {
      const published = await mutation<FormVersion>(
        apiBase,
        `${root}/form-versions/${version.id}/publish`,
        "POST",
      );
      setVersion(published);
      publishDialog.current?.close();
      await loadDefinitions();
    }, "Versión publicada e inmutable.");
  }
  async function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!version) return;
    const data = new FormData(event.currentTarget);
    await run(async () => {
      await mutation(
        apiBase,
        `${root}/offerings/${data.get("offeringId")}/form-version`,
        "PUT",
        { formVersionId: version.id },
      );
    }, "Versión publicada asignada a la oferta.");
  }

  const selected = definitions.find((item) => item.id === selectedDefinition);
  const allFields =
    version?.sections.flatMap((section) => section.fields) ?? [];
  return (
    <div className="builder-layout">
      <div className="builder-toolbar">
        <label className="field">
          <span>Definición</span>
          <select
            onChange={(event) => {
              setSelectedDefinition(event.target.value);
              setVersion(null);
              setEditingField(null);
              setEditingSection(null);
            }}
            value={selectedDefinition}
          >
            <option value="">Seleccionar</option>
            {definitions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button button-primary"
          disabled={!selectedDefinition}
          onClick={() => void createVersion()}
          type="button"
        >
          Nueva versión
        </button>
        {selected?.versions.map((item) => (
          <button
            className="version-chip"
            key={item.id}
            onClick={() => void reloadVersion(item.id)}
            type="button"
          >
            v{item.versionNumber} · {item.lifecycle}
          </button>
        ))}
      </div>
      <p aria-live="polite" className="form-help">
        {notice}
      </p>
      {error ? (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      ) : null}
      <details className="builder-create" open={!selectedDefinition}>
        <summary>Nueva definición de formulario</summary>
        <form className="form-card form-wide" onSubmit={createDefinition}>
          <label className="field">
            <span>Nombre</span>
            <input name="name" required />
          </label>
          <button className="button button-primary">Crear definición</button>
        </form>
      </details>
      {selectedDefinition && !version ? (
        <div className="empty-state">
          Selecciona una versión o crea una nueva. Las versiones publicadas no
          se editan.
        </div>
      ) : null}
      {version ? (
        <>
          <div className="builder-status">
            <div>
              <h3>Versión {version.versionNumber}</h3>
              <span
                className={`badge ${version.lifecycle === "DRAFT" ? "badge-draft" : "badge-open"}`}
              >
                {version.lifecycle}
              </span>
            </div>
            <div className="flow-actions">
              <button
                className="button button-secondary"
                onClick={() => setPreview((value) => !value)}
                type="button"
              >
                {preview ? "Volver al editor" : "Vista previa"}
              </button>
              {version.lifecycle === "DRAFT" ? (
                <button
                  className="button button-primary"
                  onClick={() => publishDialog.current?.showModal()}
                  type="button"
                >
                  Publicar versión
                </button>
              ) : (
                <button
                  className="button button-primary"
                  onClick={() => void createVersion(version.id)}
                  type="button"
                >
                  Crear revisión editable
                </button>
              )}
            </div>
          </div>
          {preview ? (
            <BuilderPreview version={version} />
          ) : version.lifecycle === "DRAFT" ? (
            <div className="builder-columns">
              <div className="builder-canvas">
                {version.sections.map((section, sectionIndex) => (
                  <section className="builder-section" key={section.id}>
                    <div className="builder-item-heading">
                      <div>
                        <h3>{section.title}</h3>
                        <p>{section.description}</p>
                      </div>
                      <div>
                        <button
                          aria-label={`Editar ${section.title}`}
                          onClick={() => setEditingSection(section)}
                          type="button"
                        >
                          ✎
                        </button>
                        <button
                          aria-label={`Subir ${section.title}`}
                          disabled={sectionIndex === 0}
                          onClick={() =>
                            void move("form-sections", section.id, "UP")
                          }
                          type="button"
                        >
                          ↑
                        </button>
                        <button
                          aria-label={`Bajar ${section.title}`}
                          disabled={
                            sectionIndex === version.sections.length - 1
                          }
                          onClick={() =>
                            void move("form-sections", section.id, "DOWN")
                          }
                          type="button"
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                    {section.fields.map((field, fieldIndex) => (
                      <div className="builder-field" key={field.id}>
                        <span>
                          <strong>{field.label}</strong>
                          <small>
                            {field.type} ·{" "}
                            {field.required ? "obligatorio" : "opcional"}
                            {field.condition ? " · condicional" : ""}
                          </small>
                        </span>
                        <span>
                          <button
                            aria-label={`Editar ${field.label}`}
                            onClick={() => {
                              setEditingField(field);
                              setEditingFieldSectionId(section.id);
                            }}
                            type="button"
                          >
                            ✎
                          </button>
                          <button
                            aria-label={`Subir ${field.label}`}
                            disabled={fieldIndex === 0}
                            onClick={() =>
                              void move("form-fields", field.id, "UP")
                            }
                            type="button"
                          >
                            ↑
                          </button>
                          <button
                            aria-label={`Bajar ${field.label}`}
                            disabled={fieldIndex === section.fields.length - 1}
                            onClick={() =>
                              void move("form-fields", field.id, "DOWN")
                            }
                            type="button"
                          >
                            ↓
                          </button>
                        </span>
                      </div>
                    ))}
                  </section>
                ))}
              </div>
              <div className="builder-controls">
                <form
                  className="form-card"
                  key={editingSection?.id ?? "new-section"}
                  onSubmit={editingSection ? updateSection : createSection}
                >
                  <h3>
                    {editingSection ? "Editar sección" : "Agregar sección"}
                  </h3>
                  <label className="field">
                    <span>Título</span>
                    <input
                      defaultValue={editingSection?.title}
                      name="title"
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Descripción</span>
                    <textarea
                      defaultValue={editingSection?.description ?? ""}
                      name="description"
                    />
                  </label>
                  <button className="button button-secondary">
                    {editingSection ? "Guardar cambios" : "Agregar sección"}
                  </button>
                  {editingSection ? (
                    <button
                      className="text-button"
                      onClick={() => setEditingSection(null)}
                      type="button"
                    >
                      Cancelar edición
                    </button>
                  ) : null}
                </form>
                <form
                  className="form-card"
                  key={editingField?.id ?? "new-field"}
                  onSubmit={editingField ? updateField : createField}
                >
                  <h3>{editingField ? "Editar campo" : "Agregar campo"}</h3>
                  <BuilderFieldForm
                    field={editingField}
                    fields={allFields}
                    selectedSectionId={editingFieldSectionId}
                    sections={version.sections}
                  />
                  <button className="button button-primary">
                    {editingField ? "Guardar cambios" : "Agregar campo"}
                  </button>
                  {editingField ? (
                    <button
                      className="text-button"
                      onClick={() => setEditingField(null)}
                      type="button"
                    >
                      Cancelar edición
                    </button>
                  ) : null}
                </form>
              </div>
            </div>
          ) : (
            <BuilderPreview version={version} />
          )}
          {version.lifecycle === "PUBLISHED" ? (
            <form className="form-card form-wide" onSubmit={assign}>
              <h3>Asignar a una oferta</h3>
              <label className="field">
                <span>Oferta</span>
                <select name="offeringId" required>
                  <option value="">Seleccionar</option>
                  {offerings.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code} · {item.title}
                    </option>
                  ))}
                </select>
              </label>
              <button className="button button-primary">
                Asignar versión publicada
              </button>
            </form>
          ) : null}
        </>
      ) : null}
      <dialog className="confirmation-dialog" ref={publishDialog}>
        <h2>Publicar versión {version?.versionNumber}</h2>
        <p>
          La estructura quedará inmutable. Para cambios posteriores deberás
          crear una nueva versión.
        </p>
        <div className="flow-actions">
          <button
            className="button button-secondary"
            onClick={() => publishDialog.current?.close()}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="button button-primary"
            onClick={() => void publish()}
            type="button"
          >
            Confirmar publicación
          </button>
        </div>
      </dialog>
    </div>
  );
}

function BuilderFieldForm({
  field,
  fields,
  selectedSectionId,
  sections,
}: {
  field: FormField | null;
  fields: FormField[];
  selectedSectionId: string;
  sections: FormSection[];
}) {
  const conditionCandidates = field
    ? fields.slice(
        0,
        Math.max(
          0,
          fields.findIndex((candidate) => candidate.id === field.id),
        ),
      )
    : fields;
  return (
    <>
      <label className="field">
        <span>Sección</span>
        <select defaultValue={selectedSectionId} name="sectionId" required>
          <option value="">Seleccionar</option>
          {sections.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Clave estable</span>
        <input
          defaultValue={field?.key}
          name="key"
          pattern="[A-Za-z][A-Za-z0-9_]*"
          required
        />
      </label>
      <label className="field">
        <span>Etiqueta</span>
        <input defaultValue={field?.label} name="label" required />
      </label>
      <label className="field">
        <span>Ayuda</span>
        <textarea defaultValue={field?.helpText ?? ""} name="helpText" />
      </label>
      <label className="field">
        <span>Tipo</span>
        <select defaultValue={field?.type ?? "TEXT"} name="type" required>
          {["TEXT", "TEXTAREA", "SELECT", "RADIO", "BOOLEAN", "DATE"].map(
            (item) => (
              <option key={item}>{item}</option>
            ),
          )}
        </select>
      </label>
      <label className="field">
        <span>Opciones (valor|etiqueta, una por línea)</span>
        <textarea
          defaultValue={
            field?.options
              .map((option) => `${option.value}|${option.label}`)
              .join("\n") ?? ""
          }
          name="options"
          placeholder={"si|Sí\nno|No"}
        />
      </label>
      <label className="checkbox-row">
        <input
          defaultChecked={field?.required}
          name="required"
          type="checkbox"
        />
        <span>Campo obligatorio</span>
      </label>
      <label className="field">
        <span>Propósito</span>
        <input
          defaultValue={field?.purpose ?? "admission_application"}
          name="purpose"
          required
        />
      </label>
      <label className="field">
        <span>Sensibilidad</span>
        <select
          defaultValue={field?.sensitivity ?? "restricted"}
          name="sensitivity"
        >
          <option value="internal">internal</option>
          <option value="restricted">restricted</option>
          <option value="highly_restricted">highly_restricted</option>
        </select>
      </label>
      <label className="field">
        <span>Categoría de tratamiento sensible</span>
        <select
          defaultValue={field?.processingCategory ?? "ORDINARY_ADMISSION"}
          name="processingCategory"
        >
          <option value="ORDINARY_ADMISSION">
            Admisión ordinaria (ORDINARY_ADMISSION)
          </option>
          <option value="SUPPORT_ACCOMMODATION">
            Ajustes razonables / Apoyo (SUPPORT_ACCOMMODATION)
          </option>
          <option value="PIE_NEE_DIAGNOSTIC">
            Diagnóstico PIE / NEE (PIE_NEE_DIAGNOSTIC)
          </option>
          <option value="HEALTH">Salud / Datos médicos (HEALTH)</option>
        </select>
      </label>
      <label className="field">
        <span>Mostrar si el campo…</span>
        <select
          defaultValue={field?.condition?.fieldId ?? ""}
          name="conditionFieldId"
        >
          <option value="">Siempre visible</option>
          {conditionCandidates.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Operador</span>
        <select
          defaultValue={field?.condition?.operator ?? "EQUALS"}
          name="conditionOperator"
        >
          <option value="EQUALS">es igual a</option>
          <option value="NOT_EQUALS">no es igual a</option>
          <option value="IN">está en la lista</option>
        </select>
      </label>
      <label className="field">
        <span>Valor de condición</span>
        <input
          defaultValue={
            Array.isArray(field?.condition?.value)
              ? field?.condition?.value.join(",")
              : String(field?.condition?.value ?? "")
          }
          name="conditionValue"
        />
      </label>
    </>
  );
}

function BuilderPreview({ version }: { version: FormVersion }) {
  return (
    <div className="preview-shell">
      <div className="preview-banner">
        {version.lifecycle === "DRAFT"
          ? "VISTA PREVIA · NO PUBLICADO"
          : "VISTA PREVIA · SOLO LECTURA"}
      </div>
      {version.sections.map((section) => (
        <section className="preview-section" key={section.id}>
          <h3>{section.title}</h3>
          <p className="muted">{section.description}</p>
          {section.fields.map((field) => (
            <DynamicField
              field={field}
              key={field.id}
              onChange={() => undefined}
              value={undefined}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
