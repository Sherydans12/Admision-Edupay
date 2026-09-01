import {
  buildSessionCookieOptions,
  ForbiddenError,
  getElevationContext,
  getCorrelationId,
  InMemoryCsrfService,
  PERMISSIONS,
  PrismaClient,
  resolveEffectiveTenantContext,
  SessionService,
  StatelessCsrfService,
  SupportElevationService,
  type CsrfService,
  type FamilyExecutionContext,
  type PlatformExecutionContext,
  type PermissionKey,
  type TenantExecutionContext,
} from "@admission/database";
import { Injectable, UnauthorizedException } from "@nestjs/common";

interface RequestLike {
  headers?: Record<string, string | string[] | undefined>;
  method?: string;
}

export interface SessionMembershipSnapshot {
  permissions: string[];
  roleKeys: string[];
  tenantId: string;
  tenantName: string;
}

export interface AuthenticatedSessionSnapshot {
  authenticated: true;
  familyProfileId: string | null;
  memberships: SessionMembershipSnapshot[];
  session: {
    absoluteExpiresAt: string;
    idleExpiresAt: string;
    id: string;
  };
  user: {
    email: string;
    emailVerifiedAt: string | null;
    id: string;
  };
}

function firstHeader(request: RequestLike, name: string): string | undefined {
  const value = request.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function readCookie(request: RequestLike, name: string): string | undefined {
  const cookieHeader = firstHeader(request, "cookie");
  if (cookieHeader === undefined) return undefined;
  for (const part of cookieHeader.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=") || undefined;
  }
  return undefined;
}

const FAMILY_CAPABILITIES = [
  PERMISSIONS.ACTIVITY_READ,
  PERMISSIONS.APPLICATION_CREATE,
  PERMISSIONS.APPLICATION_AUTHORITY_DECLARE,
  PERMISSIONS.APPLICATION_AUTHORITY_READ,
  PERMISSIONS.APPLICATION_READ,
  PERMISSIONS.APPLICATION_SUBMIT,
  PERMISSIONS.APPLICATION_WRITE,
  PERMISSIONS.DOCUMENT_READ,
  PERMISSIONS.DOCUMENT_UPLOAD,
  PERMISSIONS.FAMILY_PROFILE_READ,
  PERMISSIONS.FAMILY_PROFILE_WRITE,
  PERMISSIONS.STUDENT_READ,
  PERMISSIONS.STUDENT_WRITE,
] as const;

@Injectable()
export class RequestContextService {
  private readonly csrf: CsrfService;
  private readonly expectedOrigin =
    process.env.ADMISSION_APP_ORIGIN ?? "http://localhost:3000";

  constructor(
    private readonly prisma: PrismaClient,
    private readonly sessions: SessionService,
    private readonly supportElevations: SupportElevationService,
  ) {
    if (process.env.NODE_ENV === "production") {
      const secret = process.env.CSRF_SIGNING_SECRET;
      if (secret === undefined) {
        throw new Error("CSRF_SIGNING_SECRET is required in production");
      }
      this.csrf = new StatelessCsrfService(secret);
    } else {
      this.csrf = new InMemoryCsrfService();
    }
  }

  async requirePlatformContext(
    request: RequestLike,
    purpose: string,
  ): Promise<PlatformExecutionContext> {
    const session = await this.requireUser(request);
    const configuredIds = new Set(
      (process.env.ADMISSION_PLATFORM_SUPPORT_USER_IDS ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    );
    if (
      process.env.NODE_ENV === "production" ||
      !configuredIds.has(session.userId)
    ) {
      throw new ForbiddenError();
    }
    return {
      actorId: session.userId,
      correlationId: getCorrelationId() ?? "unbound-request",
      effectiveActorId: session.userId,
      globalCapabilities: [
        PERMISSIONS.PLATFORM_SUPPORT_ELEVATE,
        PERMISSIONS.REPORT_READ,
        PERMISSIONS.REPORT_EXPORT,
        PERMISSIONS.AUDIT_READ,
        PERMISSIONS.RESTRICTED_READ,
        PERMISSIONS.ROLE_ASSIGNMENT_READ,
        PERMISSIONS.ADMISSION_CONFIG_READ,
        PERMISSIONS.APPLICATION_READ,
        PERMISSIONS.APPLICATION_HANDOFF_REQUEST,
        PERMISSIONS.DOCUMENT_READ,
        PERMISSIONS.ACTIVITY_READ,
        PERMISSIONS.CAPACITY_READ,
        PERMISSIONS.WAITLIST_READ,
        PERMISSIONS.OFFER_READ,
        PERMISSIONS.COMMUNICATION_READ,
        PERMISSIONS.DASHBOARD_READ,
      ],
      globalSuperadmin: true,
      purpose,
      source: "authenticated_request",
    };
  }

  async requireUser(request: RequestLike) {
    const token = this.readSessionToken(request);
    if (token === undefined) throw new UnauthorizedException();
    const session = await this.sessions.resolveSession(token);
    if (session === undefined) throw new UnauthorizedException();
    return session;
  }

  /**
   * Resolves the current browser session without turning an anonymous visit
   * into an HTTP error. This is intentionally read-only and exposes only the
   * caller's own identity/access summary; authorization remains server-side
   * in each tenant endpoint.
   */
  async getOptionalSessionSnapshot(
    request: RequestLike,
  ): Promise<AuthenticatedSessionSnapshot | undefined> {
    const token = this.readSessionToken(request);
    if (token === undefined) return undefined;
    const session = await this.sessions.resolveSession(token);
    if (session === undefined) return undefined;

    const user = await this.prisma.platformUser.findUnique({
      select: {
        emailNormalized: true,
        emailVerifiedAt: true,
        familyProfile: { select: { id: true } },
        id: true,
        memberships: {
          orderBy: { createdAt: "asc" },
          select: {
            roleAssignments: {
              orderBy: { createdAt: "asc" },
              select: { permissions: true, roleKey: true },
              where: { status: "ACTIVE" },
            },
            status: true,
            tenant: { select: { id: true, name: true, status: true } },
            tenantId: true,
          },
          where: { status: "ACTIVE" },
        },
        status: true,
      },
      where: { id: session.userId },
    });
    if (user === null || user.status !== "ACTIVE") return undefined;

    return {
      authenticated: true,
      familyProfileId: user.familyProfile?.id ?? null,
      memberships: user.memberships
        .filter((membership) => membership.tenant.status === "ACTIVE")
        .map((membership) => ({
          permissions: [
            ...new Set(
              membership.roleAssignments.flatMap(
                (assignment) => assignment.permissions,
              ),
            ),
          ],
          roleKeys: membership.roleAssignments.map(
            (assignment) => assignment.roleKey,
          ),
          tenantId: membership.tenantId,
          tenantName: membership.tenant.name,
        })),
      session: {
        absoluteExpiresAt: session.absoluteExpiresAt.toISOString(),
        idleExpiresAt: session.idleExpiresAt.toISOString(),
        id: session.sessionId,
      },
      user: {
        email: user.emailNormalized,
        emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
        id: user.id,
      },
    };
  }

  async revokeCurrentSession(request: RequestLike): Promise<void> {
    const token = this.readSessionToken(request);
    if (token !== undefined) await this.sessions.revokeSession(token);
  }

  private readSessionToken(request: RequestLike): string | undefined {
    return readCookie(
      request,
      buildSessionCookieOptions({ environment: "local" }).name,
    );
  }

  async issueCsrfToken(request: RequestLike): Promise<string> {
    const session = await this.requireUser(request);
    return this.csrf.issueToken(session.sessionId);
  }

  async assertMutationSafe(request: RequestLike): Promise<void> {
    const method = (request.method ?? "GET").toUpperCase();
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
      return;
    }
    const session = await this.requireUser(request);
    const origin = firstHeader(request, "origin");
    const referer = firstHeader(request, "referer");
    const token = firstHeader(request, "x-csrf-token");
    const csrfInput = {
      expectedOrigin: this.expectedOrigin,
      method,
      sessionId: session.sessionId,
      ...(token === undefined ? {} : { csrfToken: token }),
      ...(origin === undefined ? {} : { origin }),
      ...(referer === undefined ? {} : { referer }),
    } as const;
    if (!this.csrf.validate(csrfInput)) {
      throw new ForbiddenError();
    }
  }

  async requireFamilyContext(
    request: RequestLike,
    purpose: string,
    options: { requiresProfile?: boolean } = {},
  ): Promise<FamilyExecutionContext> {
    const session = await this.requireUser(request);
    const user = await this.prisma.platformUser.findUnique({
      select: { familyProfile: { select: { id: true } }, status: true },
      where: { id: session.userId },
    });
    if (user === null || user.status !== "ACTIVE") {
      throw new UnauthorizedException();
    }
    if (options.requiresProfile === true && user.familyProfile === null) {
      throw new UnauthorizedException();
    }

    return {
      actorId: session.userId,
      contextOrigin: "family_profile",
      correlationId: getCorrelationId() ?? "unbound-request",
      effectiveActorId: session.userId,
      familyCapabilities: FAMILY_CAPABILITIES,
      purpose,
      source: "authenticated_request",
    };
  }

  async resolvePublicAdmissionContext(
    request: RequestLike,
    tenantId: string,
    purpose: string,
  ): Promise<TenantExecutionContext> {
    const session = await this.requireUser(request);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (tenant === null || tenant.status !== "ACTIVE") {
      throw new UnauthorizedException();
    }

    return {
      actorId: session.userId,
      capabilities: [PERMISSIONS.OFFERING_PUBLIC_READ],
      contextOrigin: "public_admission",
      correlationId: getCorrelationId() ?? "unbound-request",
      effectiveActorId: session.userId,
      purpose,
      source: "authenticated_request",
      tenantId,
    };
  }

  async requireApplicationTenant(
    request: RequestLike,
    tenantId: string,
    purpose: string,
    permission: PermissionKey = PERMISSIONS.APPLICATION_READ,
  ): Promise<TenantExecutionContext> {
    const session = await this.requireUser(request);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (tenant === null || tenant.status !== "ACTIVE") {
      throw new UnauthorizedException();
    }

    return {
      actorId: session.userId,
      capabilities: [permission],
      contextOrigin: "family_application",
      correlationId: getCorrelationId() ?? "unbound-request",
      effectiveActorId: session.userId,
      purpose,
      source: "authenticated_request",
      tenantId,
    };
  }

  async requireAdminTenant(
    request: RequestLike,
    tenantId: string,
    purpose: string,
  ): Promise<TenantExecutionContext> {
    const session = await this.requireUser(request);
    const resolved = await resolveEffectiveTenantContext({
      authenticatedUserId: session.userId,
      correlationId: getCorrelationId() ?? "unbound-request",
      prisma: this.prisma,
      purpose,
      requestedTenantCandidate: tenantId,
    });
    if (resolved.decision === "ALLOW") return resolved.context;

    const elevationId = firstHeader(request, "x-support-elevation-id");
    if (
      elevationId === undefined ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        elevationId,
      )
    ) {
      throw new ForbiddenError();
    }
    const platformContext = await this.requirePlatformContext(
      request,
      "platform.support",
    );
    const elevation =
      await this.supportElevations.resolveActiveSupportElevation({
        actorId: session.userId,
        elevationId,
        targetTenantId: tenantId,
      });
    if (elevation === undefined) throw new ForbiddenError();
    return getElevationContext(platformContext, elevation);
  }
}
