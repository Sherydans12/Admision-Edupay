-- E5-H migration 14: permit only the approved SessionService events in the
-- existing platform-global AuditEvent boundary. No table or bypass is added.

ALTER TABLE "audit_events"
  DROP CONSTRAINT "audit_events_platform_global_action_check",
  ADD CONSTRAINT "audit_events_platform_global_action_check"
  CHECK (
    "scope" = 'TENANT'
    OR "action" IN (
      'FAMILY_PROFILE_CREATED',
      'FAMILY_PROFILE_UPDATED',
      'STUDENT_CREATED',
      'STUDENT_UPDATED',
      'SESSION_ISSUED',
      'SESSION_ROTATED',
      'SESSION_REVOKED',
      'ALL_USER_SESSIONS_REVOKED'
    )
  );

