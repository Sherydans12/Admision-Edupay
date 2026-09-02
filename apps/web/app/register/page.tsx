"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { PublicAuthShell } from "../ui-foundation";

const API_BASE =
  process.env.NEXT_PUBLIC_ADMISSION_API_URL ?? "http://localhost:3001";

export default function RegisterPage() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (submitted || error) statusRef.current?.focus();
  }, [error, submitted]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "")
      .trim()
      .toLowerCase();
    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        body: JSON.stringify({ email }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!response.ok) throw new Error("register_failed");
      window.sessionStorage.setItem(
        "admission.pendingVerificationEmail",
        email,
      );
      setSubmitted(true);
    } catch {
      setError(
        "No pudimos iniciar el registro. Revisa el correo e inténtalo nuevamente.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PublicAuthShell
      currentStep={submitted ? 2 : 1}
      description="Solicita un código de acceso y úsalo para iniciar una sesión segura en el portal."
      title="Inicia sesión o crea tu acceso"
    >
      <div className="auth-card-heading">
        <h2>{submitted ? "Revisa tu correo" : "Solicita un código"}</h2>
        <p>
          {submitted
            ? "El siguiente paso es ingresar el código recibido."
            : "Usa un correo sintético que puedas revisar. El mismo acceso sirve para crear una cuenta o recuperar la sesión."}
        </p>
      </div>
      <p className="auth-boundary-note">
        Verificar el correo no demuestra identidad civil, parentesco ni facultad
        legal sobre un estudiante.
      </p>
      {submitted ? (
        <div className="auth-result">
          <div
            className="alert alert-success"
            ref={statusRef}
            role="status"
            tabIndex={-1}
          >
            Código solicitado. Revisa el correo e ingrésalo en la pantalla de
            verificación.
          </div>
          <a className="button button-primary" href="/register/verify">
            Continuar con el código
          </a>
          <button
            className="text-button"
            onClick={() => setSubmitted(false)}
            type="button"
          >
            Usar otro correo
          </button>
        </div>
      ) : (
        <form aria-busy={submitting} className="auth-form" onSubmit={submit}>
          <label className="field" htmlFor="register-email">
            Correo electrónico
            <input
              autoComplete="email"
              autoFocus
              disabled={submitting}
              id="register-email"
              name="email"
              required
              type="email"
            />
          </label>
          <button
            className="button button-primary"
            disabled={submitting}
            type="submit"
          >
            {submitting
              ? "Solicitando código…"
              : "Enviar código para continuar"}
          </button>
          {error ? (
            <div
              className="alert alert-error"
              ref={statusRef}
              role="alert"
              tabIndex={-1}
            >
              {error}
              <span>Tu correo no se modificó. Puedes volver a intentarlo.</span>
            </div>
          ) : null}
        </form>
      )}
      <nav className="public-auth-links" aria-label="Acciones de cuenta">
        <a href="/register/verify">Ya tengo un código de verificación</a>
        <a href="/">Ya tengo una sesión activa</a>
      </nav>
    </PublicAuthShell>
  );
}
