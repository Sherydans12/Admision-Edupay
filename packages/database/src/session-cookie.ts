export type CookieSameSite = "lax" | "none" | "strict";

export interface SessionCookieOptions {
  httpOnly: true;
  name: "admission_session";
  path: "/";
  sameSite: CookieSameSite;
  secure: boolean;
}

export interface SessionCookieProfile {
  environment: "local" | "production" | "staging" | "test";
  sameSite?: CookieSameSite;
  secureOverride?: boolean;
}

export function buildSessionCookieOptions(
  profile: SessionCookieProfile,
): SessionCookieOptions {
  const sameSite = profile.sameSite ?? "lax";
  const secure =
    profile.environment === "local" || profile.environment === "test"
      ? (profile.secureOverride ?? false)
      : true;

  if (sameSite === "none" && !secure) {
    throw new Error("SameSite=None requires Secure cookies");
  }

  return {
    httpOnly: true,
    name: "admission_session",
    path: "/",
    sameSite,
    secure,
  };
}

export function createOpaqueSessionCookie(
  token: string,
  options: SessionCookieOptions,
) {
  if (token.trim() === "" || token.includes(";")) {
    throw new Error("Session cookie value must be an opaque token");
  }

  return { name: options.name, options, value: token } as const;
}
