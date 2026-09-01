"use client";

import { FormEvent, useState } from "react";

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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
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
    <main className="public-auth-shell">
      <section className="public-auth-card" aria-labelledby="verify-title">
        <p className="eyebrow">Admisión · verificación de cuenta</p>
        <h1 id="verify-title">Verifica tu correo</h1>
        <p className="lede">
          Ingresa el código recibido en el mensaje de verificación.
        </p>
        {verified ? (
          <>
            <div className="alert alert-success" role="status">
              Cuenta verificada y sesión iniciada. Ya puedes continuar con el
              portal.
            </div>
            <a className="button button-primary" href="/">
              Continuar al portal
            </a>
          </>
        ) : (
          <form className="form-card" onSubmit={submit}>
            <label className="field" htmlFor="verification-email">
              Correo para solicitar otro código (opcional)
              <input
                autoComplete="email"
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
                id="verification-challenge"
                name="challenge"
                required
                spellCheck={false}
                type="text"
              />
            </label>
            <button className="button button-primary" type="submit">
              Verificar cuenta
            </button>
            <button
              className="button button-secondary"
              disabled={resending}
              onClick={(event) => {
                event.preventDefault();
                void resend();
              }}
              type="button"
            >
              {resending ? "Solicitando…" : "Enviar otro código"}
            </button>
            {resendMessage ? (
              <p className="alert alert-success" role="status">
                {resendMessage}
              </p>
            ) : null}
            {error ? (
              <p className="alert alert-error" role="alert">
                {error}
              </p>
            ) : null}
          </form>
        )}
        <nav className="public-auth-links" aria-label="Acciones de cuenta">
          <a href="/register">Solicitar otra verificación</a>
          <a href="/">Volver al portal</a>
        </nav>
      </section>
    </main>
  );
}
