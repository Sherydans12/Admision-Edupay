"use client";

import { FormEvent, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_ADMISSION_API_URL ?? "http://localhost:3001";

export default function VerifyPage() {
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");

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
      setVerified(true);
    } catch {
      setError(
        "El código no pudo usarse. Solicita una nueva verificación e inténtalo nuevamente.",
      );
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
          <div className="alert alert-success" role="status">
            Cuenta verificada. Ya puedes continuar con el portal familiar.
          </div>
        ) : (
          <form className="form-card" onSubmit={submit}>
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
