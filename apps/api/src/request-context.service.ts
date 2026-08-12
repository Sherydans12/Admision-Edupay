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
  SupportElevationService,
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
  private readonly csrf = new InMemoryCsrfService();
  private readonly expectedOrigin =
    process.env.ADMISSION_APP_ORIGIN ?? "http://localhost:3000";

  constructor(
    private readonly prisma: PrismaClient,
    private readonly sessions: SessionService,
    private readonly supportElevations: SupportElevationService,
  ) {}

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
    const token = readCookie(
      request,
      buildSessionCookieOptions({ environment: "local" }).name,
    );
    if (token === undefined) throw new UnauthorizedException();
    const session = await this.sessions.resolveSession(token);
    if (session === undefined) throw new UnauthorizedException();
    return session;
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
