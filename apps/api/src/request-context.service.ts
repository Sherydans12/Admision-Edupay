import {
  buildSessionCookieOptions,
  ForbiddenError,
  getCorrelationId,
  InMemoryCsrfService,
  PERMISSIONS,
  PrismaClient,
  resolveEffectiveTenantContext,
  SessionService,
  type TenantExecutionContext,
} from "@admission/database";
import { Injectable, UnauthorizedException } from "@nestjs/common";

interface RequestLike {
  headers?: Record<string, string | string[] | undefined>;
}

function firstHeader(request: RequestLike, name: string): string | undefined {
  const value = request.headers?.[name];
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

@Injectable()
export class RequestContextService {
  private readonly csrf = new InMemoryCsrfService();
  private readonly expectedOrigin =
    process.env.ADMISSION_APP_ORIGIN ?? "http://localhost:3000";

  constructor(
    private readonly prisma: PrismaClient,
    private readonly sessions: SessionService,
  ) {}

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
    const session = await this.requireUser(request);
    const origin = firstHeader(request, "origin");
    const token = firstHeader(request, "x-csrf-token");
    const csrfInput = {
      expectedOrigin: this.expectedOrigin,
      method: "POST",
      sessionId: session.sessionId,
      ...(token === undefined ? {} : { csrfToken: token }),
      ...(origin === undefined ? {} : { origin }),
    } as const;
    if (!this.csrf.validate(csrfInput)) {
      throw new ForbiddenError();
    }
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
    if (resolved.decision === "DENY") throw new ForbiddenError();
    return resolved.context;
  }

  async requireFamilyTenant(
    request: RequestLike,
    tenantId: string,
    purpose: string,
  ): Promise<TenantExecutionContext> {
    const session = await this.requireUser(request);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (tenant === null || tenant.status !== "ACTIVE")
      throw new UnauthorizedException();

    return {
      actorId: session.userId,
      capabilities: [
        PERMISSIONS.APPLICATION_CREATE,
        PERMISSIONS.APPLICATION_READ,
        PERMISSIONS.APPLICATION_WRITE,
        PERMISSIONS.FAMILY_PROFILE_READ,
        PERMISSIONS.FAMILY_PROFILE_WRITE,
        PERMISSIONS.OFFERING_PUBLIC_READ,
        PERMISSIONS.STUDENT_READ,
        PERMISSIONS.STUDENT_WRITE,
      ],
      contextOrigin: "family_profile",
      correlationId: getCorrelationId() ?? "unbound-request",
      effectiveActorId: session.userId,
      purpose,
      source: "authenticated_request",
      tenantId,
    };
  }
}
