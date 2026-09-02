"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { PublicAuthShell } from "../../ui-foundation";

const API_BASE =
  process.env.NEXT_PUBLIC_ADMISSION_API_URL ?? "http://localhost:3001";

export default function VerifyPage() {
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState(() => {
    if (typeof window === "undefined") return "";
    return (
      window.sessionStorage.getItem("admission.pendingVerificationEmail") ?? ""
    );
  });
  const [resendMessage, setResendMessage] = useState("");
  const [resending, setResending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (verified || error || resendMessage) statusRef.current?.focus();
  }, [error, resendMessage, verified]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResendMessage("");
    const data = new FormData(event.currentTarget);
    setVerifying(true);
    try {
      const response = await fetch(`${API_BASE}/auth/verify`, {
        body: JSON.stringify({ challenge: data.get("challenge") }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!response.ok) throw new Error("verification_failed");
      window.sessionStorage.removeItem("admission.pendingVerificationEmail");
      setVerified(true);
    } catch {
      setError(
        "El código no pudo usarse. Solicita una nueva verificación e inténtalo nuevamente.",
      );
    } finally {
      setVerifying(false);
    }
  }

  async function resend(): Promise<void> {
    setError("");
    setResendMessage("");
    if (email.trim() === "") {
      setError("Ingresa tu correo para solicitar otro código.");
      return;
    }
    setResending(true);
    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!response.ok) throw new Error("resend_failed");
      window.sessionStorage.setItem(
        "admission.pendingVerificationEmail",
        email.trim().toLowerCase(),
      );
      setResendMessage(
        "Si el correo puede utilizarse, enviamos un nuevo código.",
      );
    } catch {
      setError("No pudimos solicitar otro código. Inténtalo nuevamente.");
    } finally {
      setResending(false);
    }
  }

  return (
    <PublicAuthShell
      currentStep={verified ? 3 : 2}
      description="Ingresa el código recibido para confirmar el correo e iniciar tu sesión."
      title="Verifica tu correo"
    >
      <div className="auth-card-heading">
        <h2>{verified ? "Sesión iniciada" : "Ingresa tu código"}</h2>
        <p>
          {verified
            ? "Tu acceso está listo. Puedes continuar donde dejaste el recorrido."
            : "El código se puede pegar directamente y se utiliza una sola vez."}
        </p>
      </div>
      {verified ? (
        <div className="auth-result">
          <div
            className="alert alert-success"
            ref={statusRef}
            role="status"
            tabIndex={-1}
          >
            Cuenta verificada y sesión iniciada correctamente.
          </div>
          <a className="button button-primary" href="/">
            Continuar al portal familiar
          </a>
        </div>
      ) : (
        <form
          aria-busy={verifying || resending}
          className="auth-form"
          onSubmit={submit}
        >
          <label className="field" htmlFor="verification-email">
            Correo para solicitar otro código (opcional)
            <input
              autoComplete="email"
              disabled={verifying || resending}
              id="verification-email"
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
          </label>
          <label className="field" htmlFor="verification-challenge">
            Código de verificación
            <input
              autoComplete="one-time-code"
              autoFocus
              disabled={verifying || resending}
              id="verification-challenge"
              name="challenge"
              required
              spellCheck={false}
              type="text"
            />
          </label>
          <button
            className="button button-primary"
            disabled={verifying || resending}
            type="submit"
          >
            {verifying ? "Verificando…" : "Verificar e iniciar sesión"}
          </button>
          <button
            className="button button-secondary"
            disabled={verifying || resending}
            onClick={(event) => {
              event.preventDefault();
              void resend();
            }}
            type="button"
          >
            {resending ? "Solicitando…" : "Enviar otro código"}
          </button>
          {resendMessage ? (
            <div
              className="alert alert-success"
              ref={statusRef}
              role="status"
              tabIndex={-1}
            >
              {resendMessage}
            </div>
          ) : null}
          {error ? (
            <div
              className="alert alert-error"
              ref={statusRef}
              role="alert"
              tabIndex={-1}
            >
              {error}
              <span>El código no fue descartado desde esta pantalla.</span>
            </div>
          ) : null}
        </form>
      )}
      <nav className="public-auth-links" aria-label="Acciones de cuenta">
        <a href="/register">Solicitar un código nuevo</a>
        <a href="/">Ya tengo una sesión activa</a>
      </nav>
    </PublicAuthShell>
  );
}
