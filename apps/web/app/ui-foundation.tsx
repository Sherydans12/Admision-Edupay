"use client";

import { type ReactNode, useEffect, useId, useRef } from "react";

export function AppShell({
  children,
  header,
  hero,
}: {
  children: ReactNode;
  header: ReactNode;
  hero: ReactNode;
}) {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Saltar al contenido
      </a>
      <header className="topbar">{header}</header>
      <main className="shell" id="main-content">
        {hero}
        {children}
      </main>
    </>
  );
}

export function PublicAuthShell({
  children,
  currentStep,
  description,
  title,
}: {
  children: ReactNode;
  currentStep: 1 | 2 | 3;
  description: string;
  title: string;
}) {
  const steps = ["Solicitar código", "Verificar correo", "Continuar"];

  return (
    <AppShell
      header={
        <>
          <a className="auth-brand-link" href="/">
            <span className="brand">Admisión EduPay</span>
            <span>Portal de preproducción</span>
          </a>
          <div className="auth-header-actions">
            <a className="button button-quiet" href="/">
              Volver al portal
            </a>
          </div>
        </>
      }
      hero={
        <section className="auth-hero" aria-labelledby="auth-page-title">
          <div>
            <h1 id="auth-page-title">{title}</h1>
            <p className="lede">{description}</p>
          </div>
          <span className="badge badge-synthetic">Sólo datos sintéticos</span>
        </section>
      }
    >
      <div className="auth-layout">
        <nav aria-label="Progreso de acceso" className="auth-stepper">
          <ol>
            {steps.map((step, index) => {
              const stepNumber = index + 1;
              const current = stepNumber === currentStep;
              const complete = stepNumber < currentStep;
              return (
                <li
                  aria-current={current ? "step" : undefined}
                  className={
                    current
                      ? "auth-step auth-step-current"
                      : complete
                        ? "auth-step auth-step-complete"
                        : "auth-step"
                  }
                  key={step}
                >
                  <span aria-hidden="true">{stepNumber}</span>
                  <strong>{step}</strong>
                </li>
              );
            })}
          </ol>
        </nav>
        <section className="public-auth-card">{children}</section>
      </div>
    </AppShell>
  );
}

export type SectionNavItem<T extends string> = {
  key: T;
  label: string;
};

export function ResponsiveSectionNav<T extends string>({
  activeKey,
  ariaLabel,
  items,
  label,
  note,
  onSelect,
}: {
  activeKey: T;
  ariaLabel: string;
  items: ReadonlyArray<SectionNavItem<T>>;
  label: string;
  note: { body: string; title: string };
  onSelect: (key: T) => void;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const activeLabel =
    items.find((item) => item.key === activeKey)?.label ?? label;

  useEffect(() => {
    const compactNavigation = window.matchMedia("(max-width: 800px)");

    function syncDisclosure(event: MediaQueryList | MediaQueryListEvent) {
      if (event.matches) {
        detailsRef.current?.removeAttribute("open");
      } else {
        detailsRef.current?.setAttribute("open", "");
      }
    }

    syncDisclosure(compactNavigation);
    compactNavigation.addEventListener("change", syncDisclosure);
    return () =>
      compactNavigation.removeEventListener("change", syncDisclosure);
  }, []);

  function select(key: T) {
    onSelect(key);
    if (window.matchMedia("(max-width: 800px)").matches) {
      detailsRef.current?.removeAttribute("open");
      window.requestAnimationFrame(() => summaryRef.current?.focus());
    }
  }

  return (
    <aside className="side-nav section-nav">
      <details open ref={detailsRef}>
        <summary className="section-nav-summary" ref={summaryRef}>
          <span>{label}</span>
          <strong>{activeLabel}</strong>
        </summary>
        <nav aria-label={ariaLabel} className="section-nav-list">
          <p className="nav-label">{label}</p>
          {items.map((item) => {
            const active = item.key === activeKey;
            return (
              <button
                aria-current={active ? "page" : undefined}
                aria-pressed={active}
                className={active ? "nav-item nav-item-active" : "nav-item"}
                key={item.key}
                onClick={() => select(item.key)}
                type="button"
              >
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="side-note">
          <strong>{note.title}</strong>
          <span>{note.body}</span>
        </div>
      </details>
    </aside>
  );
}

type StateTone = "empty" | "error" | "loading" | "success";

export function StatePanel({
  actions,
  children,
  label,
  title,
  tone,
}: {
  actions?: ReactNode;
  children: ReactNode;
  label?: string;
  title: string;
  tone: StateTone;
}) {
  return (
    <section
      aria-busy={tone === "loading"}
      aria-live={
        tone === "error"
          ? "assertive"
          : tone === "loading" || tone === "success"
            ? "polite"
            : undefined
      }
      className={`workspace auth-gate state-panel state-panel-${tone}`}
      role={
        tone === "error"
          ? "alert"
          : tone === "loading" || tone === "success"
            ? "status"
            : undefined
      }
    >
      {label ? <p className="eyebrow">{label}</p> : null}
      <h2>{title}</h2>
      <div className="state-panel-copy">{children}</div>
      {actions ? <div className="flow-actions">{actions}</div> : null}
    </section>
  );
}

export function AccessibleConfirmationDialog({
  cancelLabel = "Cancelar",
  confirmLabel = "Confirmar",
  confirmDisabled = false,
  description,
  onCancel,
  onConfirm,
  open,
  title,
}: {
  cancelLabel?: string;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  title: string;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const initialFocusRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const onCancelRef = useRef(onCancel);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusHandle = window.requestAnimationFrame(() => {
      initialFocusRef.current?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancelRef.current();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusHandle);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="confirmation-dialog-shell">
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="confirmation-dialog-card"
        ref={dialogRef}
        role="dialog"
      >
        <h3 id={titleId}>{title}</h3>
        <p id={descriptionId}>{description}</p>
        <div className="flow-actions">
          <button
            className="button button-secondary"
            onClick={onCancel}
            ref={initialFocusRef}
            type="button"
          >
            {cancelLabel}
          </button>
          <button
            className="button button-primary"
            disabled={confirmDisabled}
            onClick={onConfirm}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
