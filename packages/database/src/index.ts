export { createAppPrismaClient } from "./prisma-client.js";
export {
  getCorrelationId,
  resolveCorrelationId,
  runWithCorrelationContext,
} from "./correlation-context.js";
export {
  authorize,
  authorizeOrThrow,
  ForbiddenError,
  type AuthorizationDecision,
  type AuthorizationRequirement,
} from "./authorization.js";
export {
  InMemoryAuditSink,
  NoopAuditSink,
  type AuditEvent,
  type AuditSink,
} from "./audit.js";
export {
  buildSessionCookieOptions,
  createOpaqueSessionCookie,
} from "./session-cookie.js";
export { InMemoryCsrfService } from "./csrf.js";
export { OutboxService, type EnqueueOutboxInput } from "./outbox.js";
export {
  PERMISSIONS,
  SENSITIVITIES,
  type PermissionKey,
  type Sensitivity,
} from "./permission-catalog.js";
export { getSessionConfig, type SessionConfig } from "./session-config.js";
export {
  SessionService,
  type IssuedSession,
  type ResolvedSession,
} from "./session-service.js";
export {
  InMemorySecurityEventSink,
  NoopSecurityEventSink,
  type SecurityEvent,
  type SecurityEventSink,
} from "./security-events.js";
export {
  SupportElevationService,
  getElevationContext,
  type CloseSupportElevationInput,
  type ResolveActiveSupportElevationInput,
  type StartSupportElevationInput,
} from "./support-elevation.js";
export {
  StructuredLogger,
  sanitizeLogValue,
  type StructuredLogEvent,
} from "./structured-logger.js";
export {
  resolveEffectiveTenantContext,
  type TenantResolutionInput,
  type TenantResolutionResult,
} from "./tenant-resolution.js";
export {
  assertTenantContext,
  getRequiredTenantContext,
  PlatformContextTenantError,
  runWithTenantContext,
  TenantContextMissingError,
  type PlatformExecutionContext,
  type VerifiedSupportElevation,
  type TenantExecutionContext,
} from "./tenant-execution-context.js";
export {
  withTenantCandidateTransaction,
  withTrustedPlatformSupportTransaction,
  withTenantTransaction,
} from "./tenant-transaction.js";
