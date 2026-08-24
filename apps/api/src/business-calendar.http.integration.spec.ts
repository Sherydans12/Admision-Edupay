import { randomUUID } from "node:crypto";
import { NestFactory } from "@nestjs/core";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  InMemoryAuditSink,
  InMemorySecurityEventSink,
  PERMISSIONS,
  SessionService,
  buildSessionCookieOptions,
  createAppPrismaClient,
} from "@admission/database";
import { AppModule } from "./app.module.js";
import { configureAdmissionApp } from "./app-bootstrap.js";

const prisma = createAppPrismaClient();
const migrationPool = new Pool({
  connectionString: process.env.DATABASE_MIGRATION_URL,
  connectionTimeoutMillis: 5_000,
});
const cookieName = buildSessionCookieOptions({ environment: "local" }).name;
let app: Awaited<ReturnType<typeof NestFactory.create>>;
let baseUrl = "";
let sessions: SessionService;

let fixture: {
  adminManageToken: string;
  adminReadOnlyToken: string;
  adminStaffBToken: string;
  tenantAId: string;
  tenantBId: string;
  userAdminManageId: string;
  userAdminReadOnlyId: string;
  userStaffBId: string;
};

async function seedFixture() {
  const tenantAId = randomUUID();
  const tenantBId = randomUUID();
  const userAdminManageId = randomUUID();
  const userAdminReadOnlyId = randomUUID();
  const userStaffBId = randomUUID();

  await migrationPool.query(
    "INSERT INTO tenants (id, name) VALUES ($1, $2), ($3, $4)",
    [tenantAId, "Tenant A HTTP BC", tenantBId, "Tenant B HTTP BC"],
  );

  await migrationPool.query(
    `INSERT INTO platform_users (id, email_normalized, email_verified_at) VALUES
      ($1, $2, CURRENT_TIMESTAMP), ($3, $4, CURRENT_TIMESTAMP), ($5, $6, CURRENT_TIMESTAMP)`,
    [
      userAdminManageId,
      `admin-manage-${userAdminManageId}@example.invalid`,
      userAdminReadOnlyId,
      `admin-read-${userAdminReadOnlyId}@example.invalid`,
      userStaffBId,
      `staff-b-${userStaffBId}@example.invalid`,
    ],
  );

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('admission.tenant_id', ${tenantAId}, true)`;
    const memManage = await tx.membership.create({
      data: {
        startsAt: new Date(now.getTime() - 60_000),
        status: "ACTIVE",
        tenantId: tenantAId,
        userId: userAdminManageId,
      },
    });
    await tx.roleAssignment.create({
      data: {
        membershipId: memManage.id,
        permissions: [
          PERMISSIONS.ADMISSION_CONFIG_READ,
          PERMISSIONS.ADMISSION_CONFIG_MANAGE,
        ],
        roleKey: "ADMINISTRADOR_SISTEMA",
        scopes: ["*"],
        startsAt: new Date(now.getTime() - 60_000),
        status: "ACTIVE",
        tenantId: tenantAId,
      },
    });

    const memRead = await tx.membership.create({
      data: {
        startsAt: new Date(now.getTime() - 60_000),
        status: "ACTIVE",
        tenantId: tenantAId,
        userId: userAdminReadOnlyId,
      },
    });
    await tx.roleAssignment.create({
      data: {
        membershipId: memRead.id,
        permissions: [PERMISSIONS.ADMISSION_CONFIG_READ],
        roleKey: "GESTOR_DOCUMENTAL",
        scopes: ["*"],
        startsAt: new Date(now.getTime() - 60_000),
        status: "ACTIVE",
        tenantId: tenantAId,
      },
    });
  });

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('admission.tenant_id', ${tenantBId}, true)`;
    const memB = await tx.membership.create({
      data: {
        startsAt: new Date(now.getTime() - 60_000),
        status: "ACTIVE",
        tenantId: tenantBId,
        userId: userStaffBId,
      },
    });
    await tx.roleAssignment.create({
      data: {
        membershipId: memB.id,
        permissions: [
          PERMISSIONS.ADMISSION_CONFIG_READ,
          PERMISSIONS.ADMISSION_CONFIG_MANAGE,
        ],
        roleKey: "ADMINISTRADOR_SISTEMA",
        scopes: ["*"],
        startsAt: new Date(now.getTime() - 60_000),
        status: "ACTIVE",
        tenantId: tenantBId,
      },
    });
  });

  sessions = new SessionService(prisma, {
    auditSink: new InMemoryAuditSink(),
    securityEvents: new InMemorySecurityEventSink(),
  });

  const [adminManageSession, adminReadOnlySession, adminStaffBSession] =
    await Promise.all([
      sessions.issueSession(userAdminManageId),
      sessions.issueSession(userAdminReadOnlyId),
      sessions.issueSession(userStaffBId),
    ]);

  fixture = {
    adminManageToken: adminManageSession.token,
    adminReadOnlyToken: adminReadOnlySession.token,
    adminStaffBToken: adminStaffBSession.token,
    tenantAId,
    tenantBId,
    userAdminManageId,
    userAdminReadOnlyId,
    userStaffBId,
  };
}

function request(path: string, options: RequestInit & { token?: string } = {}) {
  const { token, ...init } = options;
  const headers = new Headers(init.headers);
  if (token !== undefined) headers.set("Cookie", `${cookieName}=${token}`);
  return fetch(`${baseUrl}${path}`, { ...init, headers });
}

async function csrf(token: string): Promise<string> {
  const response = await request("/auth/csrf", { token });
  expect(response.status).toBe(200);
  return ((await response.json()) as { token: string }).token;
}

async function mutation(
  path: string,
  token: string,
  body: unknown,
  method = "POST",
) {
  const csrfToken = await csrf(token);
  const headers = new Headers({
    "Content-Type": "application/json",
    Origin: "http://localhost:3000",
    "X-CSRF-Token": csrfToken,
  });
  return request(path, {
    body: JSON.stringify(body),
    headers,
    method,
    token,
  });
}

beforeAll(async () => {
  await seedFixture();

  app = await NestFactory.create(AppModule, { logger: false });
  configureAdmissionApp(app);
  await app.listen(0);
  const address = app.getHttpServer().address() as { port: number };
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (app) await app.close();
  await prisma.$disconnect();
  await migrationPool.end();
});

describe("G5-PC1-R3: Business Calendar REST HTTP API (R3-HTTP-*)", () => {
  let createdExcludedDateId = "";

  it("R3-HTTP-01: GET /admin/tenants/:tenantId/business-calendar returns null initially", async () => {
    const res = await request(
      `/admin/tenants/${fixture.tenantAId}/business-calendar`,
      { token: fixture.adminManageToken },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { item: unknown };
    expect(body.item).toBeNull();
  });

  it("R3-HTTP-02: POST /admin/tenants/:tenantId/business-calendar configures calendar with valid IANA timezone", async () => {
    const res = await mutation(
      `/admin/tenants/${fixture.tenantAId}/business-calendar`,
      fixture.adminManageToken,
      { timezone: "America/Santiago" },
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      concurrencyVersion: number;
      timezone: string;
    };
    expect(body.timezone).toBe("America/Santiago");
    expect(body.concurrencyVersion).toBe(1);
  });

  it("R3-HTTP-03: POST /admin/tenants/:tenantId/business-calendar rejects invalid timezone offset with 400", async () => {
    const res = await mutation(
      `/admin/tenants/${fixture.tenantAId}/business-calendar`,
      fixture.adminManageToken,
      {
        expectedVersion: 1,
        timezone: "UTC-3",
      },
    );
    expect(res.status).toBe(400);
  });

  it("R3-HTTP-04: POST /admin/tenants/:tenantId/business-calendar detects version conflict with 409", async () => {
    const res = await mutation(
      `/admin/tenants/${fixture.tenantAId}/business-calendar`,
      fixture.adminManageToken,
      {
        expectedVersion: 99,
        timezone: "America/Punta_Arenas",
      },
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("BUSINESS_CALENDAR_VERSION_CHANGED");
  });

  it("R3-HTTP-05: GET /admin/tenants/:tenantId/business-calendar/excluded-dates returns list", async () => {
    const res = await request(
      `/admin/tenants/${fixture.tenantAId}/business-calendar/excluded-dates`,
      { token: fixture.adminReadOnlyToken },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[] };
    expect(Array.isArray(body.items)).toBe(true);
  });

  it("R3-HTTP-06: POST /admin/tenants/:tenantId/business-calendar/excluded-dates adds excluded date", async () => {
    const res = await mutation(
      `/admin/tenants/${fixture.tenantAId}/business-calendar/excluded-dates`,
      fixture.adminManageToken,
      {
        calendarDate: "2026-09-18",
        reason: "Fiestas Patrias",
      },
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      calendarDate: string;
      id: string;
      reason: string;
    };
    expect(body.calendarDate).toBe("2026-09-18");
    expect(body.reason).toBe("Fiestas Patrias");
    createdExcludedDateId = body.id;
  });

  it("R3-HTTP-07: POST /admin/tenants/:tenantId/business-calendar/excluded-dates rejects duplicate date with 409", async () => {
    const res = await mutation(
      `/admin/tenants/${fixture.tenantAId}/business-calendar/excluded-dates`,
      fixture.adminManageToken,
      {
        calendarDate: "2026-09-18",
        reason: "Intento duplicado",
      },
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("EXCLUDED_DATE_ALREADY_EXISTS");
  });

  it("R3-HTTP-08: DELETE /admin/tenants/:tenantId/business-calendar/excluded-dates/:id removes excluded date", async () => {
    const csrfToken = await csrf(fixture.adminManageToken);
    const headers = new Headers({
      Origin: "http://localhost:3000",
      "X-CSRF-Token": csrfToken,
    });
    const res = await request(
      `/admin/tenants/${fixture.tenantAId}/business-calendar/excluded-dates/${createdExcludedDateId}`,
      {
        headers,
        method: "DELETE",
        token: fixture.adminManageToken,
      },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; removed: boolean };
    expect(body.removed).toBe(true);
  });

  it("R3-HTTP-09: CSRF protection denies mutations without valid csrf token (403)", async () => {
    const res = await request(
      `/admin/tenants/${fixture.tenantAId}/business-calendar`,
      {
        body: JSON.stringify({ timezone: "America/Santiago" }),
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
        },
        method: "POST",
        token: fixture.adminManageToken,
      },
    );
    expect(res.status).toBe(403);
  });

  it("R3-HTTP-10: Tenant isolation: Tenant B session cannot read or configure Tenant A calendar (403)", async () => {
    const res = await request(
      `/admin/tenants/${fixture.tenantAId}/business-calendar`,
      { token: fixture.adminStaffBToken },
    );
    expect(res.status).toBe(403);
  });
});
