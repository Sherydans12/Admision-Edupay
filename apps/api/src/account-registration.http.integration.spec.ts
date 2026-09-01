import { createHash } from "node:crypto";

import {
  buildSessionCookieOptions,
  createAppPrismaClient,
  DevelopmentIdentityEmailAdapter,
} from "@admission/database";
import { type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { configureAdmissionApp } from "./app-bootstrap.js";
import { AppModule } from "./app.module.js";

const prisma = createAppPrismaClient();
const migrationPool = new Pool({
  connectionString: process.env.DATABASE_MIGRATION_URL,
  max: 3,
});
const cookieName = buildSessionCookieOptions({ environment: "local" }).name;

let app: INestApplication;
let baseUrl = "";
let identityEmail: DevelopmentIdentityEmailAdapter;

async function clearTables(): Promise<void> {
  await migrationPool.query(`TRUNCATE TABLE
    "audit_events", "outbox_messages", "support_elevations", "role_assignments",
    "memberships", "platform_sessions", "platform_users", "tenants" CASCADE`);
  identityEmail.deliveries.length = 0;
}

async function post(
  path: string,
  body: unknown,
  cookie?: string,
): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...(cookie === undefined ? {} : { Cookie: cookie }),
    },
    method: "POST",
  });
}

function cookieFrom(response: Response): string {
  const setCookie = response.headers.get("set-cookie");
  if (setCookie === null) throw new Error("Expected a session cookie");
  return setCookie.split(";", 1)[0] ?? "";
}

async function register(email: string): Promise<Response> {
  return post("/auth/register", { email });
}

describe.sequential("G5-BR public identity HTTP boundary", () => {
  beforeAll(async () => {
    process.env.ADMISSION_APP_ORIGIN = "http://localhost:3000";
    process.env.ADMISSION_WEB_ORIGIN = "http://localhost:3000";
    app = await NestFactory.create(AppModule, { logger: false });
    configureAdmissionApp(app);
    await app.init();
    await app.listen(0, "127.0.0.1");
    const address = app.getHttpServer().address();
    if (address === null || typeof address === "string") {
      throw new Error("HTTP test server did not expose an ephemeral port");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
    identityEmail = app.get(DevelopmentIdentityEmailAdapter);
  });

  beforeEach(clearTables);

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
    await migrationPool.end();
  });

  it("G5BR-HTTP-01: new registration returns a generic accepted response", async () => {
    const response = await register("http-new@example.invalid");
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(202);
    expect(Object.keys(body).sort()).toEqual(["correlationId", "message"]);
    expect(body.message).toBe(
      "Si el correo puede utilizarse, revisa tu bandeja para continuar.",
    );
    expect(JSON.stringify(body)).not.toContain("PlatformUser");
  });

  it("G5BR-HTTP-02: existing registration has the same status and response schema", async () => {
    const first = await register("http-existing@example.invalid");
    const firstBody = (await first.json()) as Record<string, unknown>;
    const challenge = identityEmail.deliveries.at(-1)?.challenge ?? "";
    const verified = await post("/auth/verify", { challenge });
    expect(verified.status).toBe(200);

    const existing = await register("HTTP-EXISTING@example.invalid");
    const existingBody = (await existing.json()) as Record<string, unknown>;

    expect(existing.status).toBe(first.status);
    expect(Object.keys(existingBody).sort()).toEqual(
      Object.keys(firstBody).sort(),
    );
    expect(existingBody.message).toBe(firstBody.message);
    expect(JSON.stringify(existingBody)).not.toContain("PlatformUser");
  });

  it("G5BR-HTTP-03: valid verification activates the account and sets an opaque cookie", async () => {
    await register("http-verified@example.invalid");
    const challenge = identityEmail.deliveries.at(-1)?.challenge ?? "";
    const response = await post("/auth/verify", { challenge });
    const user = await prisma.platformUser.findUnique({
      where: { emailNormalized: "http-verified@example.invalid" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("set-cookie")).toContain(`${cookieName}=`);
    expect(response.headers.get("set-cookie")?.toLowerCase()).toContain(
      "httponly",
    );
    const maxAge = Number.parseInt(
      response.headers.get("set-cookie")?.match(/max-age=(\d+)/i)?.[1] ?? "0",
      10,
    );
    // Express receives maxAge in milliseconds but serializes Max-Age in seconds.
    expect(maxAge).toBeGreaterThan(7 * 60 * 60);
    expect(user?.status).toBe("ACTIVE");
    expect(user?.emailVerifiedAt).not.toBeNull();
  });

  it("G5BR-SESSION-01: anonymous session discovery is explicit and non-sensitive", async () => {
    const response = await fetch(`${baseUrl}/auth/session`);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({ authenticated: false });
  });

  it("G5BR-SESSION-02: session discovery returns only the caller access summary", async () => {
    await register("http-session-summary@example.invalid");
    const verified = await post("/auth/verify", {
      challenge: identityEmail.deliveries.at(-1)?.challenge ?? "",
    });
    const cookie = cookieFrom(verified);
    const response = await fetch(`${baseUrl}/auth/session`, {
      headers: { Cookie: cookie },
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      authenticated: true,
      familyProfileId: null,
      memberships: [],
      user: { email: "http-session-summary@example.invalid" },
    });
    expect(JSON.stringify(body)).not.toContain("token");
  });

  it("G5BR-SESSION-03: logout requires CSRF and revokes the server session", async () => {
    await register("http-session-logout@example.invalid");
    const verified = await post("/auth/verify", {
      challenge: identityEmail.deliveries.at(-1)?.challenge ?? "",
    });
    const cookie = cookieFrom(verified);
    const csrfResponse = await fetch(`${baseUrl}/auth/csrf`, {
      headers: { Cookie: cookie },
    });
    const csrf = ((await csrfResponse.json()) as { token: string }).token;

    const rejected = await fetch(`${baseUrl}/auth/logout`, {
      headers: { Cookie: cookie, Origin: "http://attacker.example.invalid" },
      method: "POST",
    });
    expect(rejected.status).toBe(403);

    const logout = await fetch(`${baseUrl}/auth/logout`, {
      headers: {
        Cookie: cookie,
        Origin: "http://localhost:3000",
        "X-CSRF-Token": csrf,
      },
      method: "POST",
    });
    expect(logout.status).toBe(204);
    expect(logout.headers.get("set-cookie")?.toLowerCase()).toContain(
      "max-age=0",
    );

    const afterLogout = await fetch(`${baseUrl}/auth/session`, {
      headers: { Cookie: cookie },
    });
    expect(await afterLogout.json()).toEqual({ authenticated: false });
  });

  it("G5BR-HTTP-04: invalid verification returns a controlled generic error", async () => {
    const response = await post("/auth/verify", {
      challenge: "invalid-synthetic-challenge",
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      error: "VALIDATION",
      message: "Request failed",
    });
    expect(JSON.stringify(body)).not.toContain("invalid-synthetic-challenge");
  });

  it("G5BR-HTTP-05: expired verification returns a controlled error", async () => {
    await register("http-expired@example.invalid");
    const challenge = identityEmail.deliveries.at(-1)?.challenge ?? "";
    await migrationPool.query(
      `UPDATE account_verification_challenges
       SET expires_at = $1
       WHERE verifier_hash = $2`,
      [
        new Date("2020-01-01T00:00:00.000Z"),
        createHash("sha256").update(challenge).digest("hex"),
      ],
    );

    const response = await post("/auth/verify", { challenge });
    expect(response.status).toBe(400);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("G5BR-HTTP-06: replayed verification returns a controlled error", async () => {
    await register("http-replay@example.invalid");
    const challenge = identityEmail.deliveries.at(-1)?.challenge ?? "";
    const first = await post("/auth/verify", { challenge });
    const replay = await post("/auth/verify", { challenge });

    expect(first.status).toBe(200);
    expect(replay.status).toBe(400);
    expect(replay.headers.get("set-cookie")).toBeNull();
  });

  it("G5BR-HTTP-07: verification does not create membership or tenant access", async () => {
    const rejected = await post("/auth/register", {
      email: "http-no-tenant@example.invalid",
      membershipId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      tenantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    });
    expect(rejected.status).toBe(400);
    await register("http-no-tenant@example.invalid");
    const challenge = identityEmail.deliveries.at(-1)?.challenge ?? "";
    const response = await post("/auth/verify", { challenge });

    expect(response.status).toBe(200);
    expect(await prisma.membership.count()).toBe(0);
    expect(await prisma.tenant.count()).toBe(0);
  });

  it("G5BR-HTTP-08 / E2E-001-START-TO-BOUNDARY: verification precedes the existing family flow", async () => {
    await register("http-family-boundary@example.invalid");
    const challenge = identityEmail.deliveries.at(-1)?.challenge ?? "";
    const verified = await post("/auth/verify", { challenge });
    const cookie = cookieFrom(verified);
    const csrfResponse = await fetch(`${baseUrl}/auth/csrf`, {
      headers: { Cookie: cookie },
    });
    const csrf = ((await csrfResponse.json()) as { token: string }).token;
    const profile = await fetch(`${baseUrl}/family/profile`, {
      body: JSON.stringify({ displayName: "Familia sintética de borde" }),
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        Origin: "http://localhost:3000",
        "X-CSRF-Token": csrf,
      },
      method: "PUT",
    });

    expect(verified.status).toBe(200);
    expect(csrfResponse.status).toBe(200);
    expect(profile.status).toBe(200);
    expect(await prisma.membership.count()).toBe(0);
  });

  it("G5BR2-HTTP-REC-01: an ACTIVE account recovers through a new challenge and session", async () => {
    await register("http-recovery@example.invalid");
    const initialChallenge = identityEmail.deliveries.at(-1)?.challenge ?? "";
    const initial = await post("/auth/verify", { challenge: initialChallenge });
    const oldCookie = cookieFrom(initial);

    const request = await register("HTTP-RECOVERY@example.invalid");
    const recoveryChallenge = identityEmail.deliveries.at(-1)?.challenge ?? "";
    const recovered = await post("/auth/verify", {
      challenge: recoveryChallenge,
    });
    const newCookie = cookieFrom(recovered);
    const user = await prisma.platformUser.findUnique({
      where: { emailNormalized: "http-recovery@example.invalid" },
    });

    expect(request.status).toBe(202);
    expect(recovered.status).toBe(200);
    expect(newCookie).not.toBe(oldCookie);
    expect(user?.status).toBe("ACTIVE");
    expect(await prisma.platformUser.count()).toBe(1);
    expect(await prisma.platformSession.count()).toBe(2);
  });

  it("G5BR2-HTTP-REC-02: ACTIVE and nonexistent recovery requests are publicly equivalent", async () => {
    await register("http-recovery-existing@example.invalid");
    await post("/auth/verify", {
      challenge: identityEmail.deliveries.at(-1)?.challenge ?? "",
    });

    const existing = await register("HTTP-RECOVERY-EXISTING@example.invalid");
    const existingBody = (await existing.json()) as Record<string, unknown>;
    const nonexistent = await register("http-recovery-missing@example.invalid");
    const nonexistentBody = (await nonexistent.json()) as Record<
      string,
      unknown
    >;

    expect(existing.status).toBe(nonexistent.status);
    expect(Object.keys(existingBody).sort()).toEqual(
      Object.keys(nonexistentBody).sort(),
    );
    expect(existingBody.message).toBe(nonexistentBody.message);
    expect(JSON.stringify(existingBody)).not.toContain("PlatformUser");
    expect(JSON.stringify(nonexistentBody)).not.toContain("PlatformUser");
  });

  it("G5BR2-HTTP-REC-03: expired recovery challenge does not issue a session", async () => {
    await register("http-recovery-expired@example.invalid");
    await post("/auth/verify", {
      challenge: identityEmail.deliveries.at(-1)?.challenge ?? "",
    });
    await register("http-recovery-expired@example.invalid");
    const challenge = identityEmail.deliveries.at(-1)?.challenge ?? "";
    await migrationPool.query(
      `UPDATE account_verification_challenges
       SET expires_at = $1
       WHERE verifier_hash = $2`,
      [
        new Date("2020-01-01T00:00:00.000Z"),
        createHash("sha256").update(challenge).digest("hex"),
      ],
    );
    const sessionsBefore = await prisma.platformSession.count();

    const response = await post("/auth/verify", { challenge });

    expect(response.status).toBe(400);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await prisma.platformSession.count()).toBe(sessionsBefore);
  });

  it("G5BR2-HTTP-REC-04: replayed recovery challenge cannot issue a second session", async () => {
    await register("http-recovery-replay@example.invalid");
    await post("/auth/verify", {
      challenge: identityEmail.deliveries.at(-1)?.challenge ?? "",
    });
    await register("http-recovery-replay@example.invalid");
    const challenge = identityEmail.deliveries.at(-1)?.challenge ?? "";

    const first = await post("/auth/verify", { challenge });
    const sessionsAfterSuccess = await prisma.platformSession.count();
    const replay = await post("/auth/verify", { challenge });

    expect(first.status).toBe(200);
    expect(replay.status).toBe(400);
    expect(replay.headers.get("set-cookie")).toBeNull();
    expect(await prisma.platformSession.count()).toBe(sessionsAfterSuccess);
  });
});
