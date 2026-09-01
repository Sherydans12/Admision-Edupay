"use client";

import { FormEvent, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_ADMISSION_API_URL ?? "http://localhost:3001";

export default function RegisterPage() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "")
      .trim()
      .toLowerCase();
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
    }
  }

  return (
    <main className="public-auth-shell">
      <section className="public-auth-card" aria-labelledby="register-title">
        <p className="eyebrow">Admisión · cuenta de postulante</p>
        <h1 id="register-title">Crea tu cuenta o recupera el acceso</h1>
        <p className="lede">
          Usa un correo que puedas revisar para crear tu cuenta o recuperar el
          acceso. La verificación del correo no demuestra identidad civil,
          parentesco ni facultad legal sobre un estudiante.
        </p>
        {submitted ? (
          <>
            <div className="alert alert-success" role="status">
              Revisa tu correo para continuar. Si necesitas ingresar un código,
              usa la pantalla de verificación.
            </div>
            <a className="button button-primary" href="/register/verify">
              Ingresar el código recibido
            </a>
          </>
        ) : (
          <form className="form-card" onSubmit={submit}>
            <label className="field" htmlFor="register-email">
              Correo electrónico
              <input
                autoComplete="email"
                id="register-email"
                name="email"
                required
                type="email"
              />
            </label>
            <button className="button button-primary" type="submit">
              Enviar verificación o acceso
            </button>
            {error ? (
              <p className="alert alert-error" role="alert">
                {error}
              </p>
            ) : null}
          </form>
        )}
        <nav className="public-auth-links" aria-label="Acciones de cuenta">
          <a href="/register/verify">Ya tengo un código de verificación</a>
          <a href="/">Volver al portal</a>
        </nav>
      </section>
    </main>
  );
}
