export const PERMISSIONS = {
  ADMISSION_CONFIG_MANAGE: "admission.config.manage",
  ADMISSION_CONFIG_READ: "admission.config.read",
  ADMISSION_SENSITIVE_PROCESSING_CONFIGURE:
    "admission.sensitive_processing.configure",
  ACTIVITY_CLOSE: "activity.close",
  ACTIVITY_DEFINITION_MANAGE: "activity.definition.manage",
  ACTIVITY_DEFINITION_PUBLISH: "activity.definition.publish",
  ACTIVITY_PERFORM: "activity.perform",
  ACTIVITY_POLICY_MANAGE: "activity.policy.manage",
  ACTIVITY_POLICY_READ: "activity.policy.read",
  ACTIVITY_READ: "activity.read",
  ACTIVITY_REPEAT: "activity.repeat",
  ACTIVITY_RESULT_READ: "activity.result.read",
  ACTIVITY_SCHEDULE: "activity.schedule",
  APPLICATION_DECIDE: "application.decide",
  APPLICATION_HANDOFF_REQUEST: "application.handoff.request",
  APPLICATION_CREATE: "application.create",
  APPLICATION_ASSIST: "application.assist",
  APPLICATION_AUTHORITY_DECLARE: "application.authority.declare",
  APPLICATION_AUTHORITY_READ: "application.authority.read",
  APPLICATION_AUTHORITY_REVIEW: "application.authority.review",
  APPLICATION_READ: "application.read",
  APPLICATION_RECOMMEND: "application.recommend",
  APPLICATION_SUBMIT: "application.submit",
  APPLICATION_WRITE: "application.write",
  CAPACITY_READ: "capacity.read",
  CAPACITY_MANAGE: "capacity.manage",
  COMMUNICATION_CONFIRM: "communication.confirm",
  COMMUNICATION_READ: "communication.read",
  COMMUNICATION_RETRY: "communication.retry",
  DASHBOARD_READ: "dashboard.read",
  DOCUMENT_EXEMPT: "document.exempt",
  DOCUMENT_READ: "document.read",
  DOCUMENT_REQUIREMENT_MANAGE: "document.requirement.manage",
  DOCUMENT_REQUIREMENT_PUBLISH: "document.requirement.publish",
  DOCUMENT_REQUIREMENT_READ: "document.requirement.read",
  DOCUMENT_REVIEW: "document.review",
  DOCUMENT_UPLOAD: "document.upload",
  FAMILY_PROFILE_READ: "family.profile.read",
  FAMILY_PROFILE_WRITE: "family.profile.write",
  FORM_MANAGE: "form.manage",
  FORM_PUBLISH: "form.publish",
  FORM_READ: "form.read",
  MANUAL_CONTACT_RECORD: "manual_contact.record",
  OFFERING_PUBLIC_READ: "offering.public.read",
  OFFER_READ: "offer.read",
  OFFER_REOPEN: "offer.reopen",
  PLATFORM_SUPPORT_ELEVATE: "platform.support.elevate",
  REPORT_READ: "report.read",
  REPORT_EXPORT: "report.export",
  ROLE_ASSIGNMENT_READ: "role_assignment.read",
  ROLE_ASSIGNMENT_MANAGE: "role_assignment.manage",
  AUDIT_READ: "audit.read",
  RESTRICTED_READ: "restricted.read",
  STUDENT_READ: "student.read",
  STUDENT_WRITE: "student.write",
  WAITLIST_PROMOTE: "waitlist.promote",
  WAITLIST_READ: "waitlist.read",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const SENSITIVITIES = {
  HIGHLY_RESTRICTED: "highly_restricted",
  INTERNAL: "internal",
  RESTRICTED: "restricted",
} as const;

export type Sensitivity = (typeof SENSITIVITIES)[keyof typeof SENSITIVITIES];

export const PROCESSING_CATEGORIES = {
  ORDINARY_ADMISSION: "ORDINARY_ADMISSION",
  SUPPORT_ACCOMMODATION: "SUPPORT_ACCOMMODATION",
  PIE_NEE_DIAGNOSTIC: "PIE_NEE_DIAGNOSTIC",
  HEALTH: "HEALTH",
} as const;

export type ProcessingCategoryValue =
  (typeof PROCESSING_CATEGORIES)[keyof typeof PROCESSING_CATEGORIES];

/**
 * Categories that are disabled by default and require explicit tenant policy
 * activation before publication or submission is allowed (R4-003, R4-004).
 */
export const SENSITIVE_PROCESSING_CATEGORIES = [
  PROCESSING_CATEGORIES.PIE_NEE_DIAGNOSTIC,
  PROCESSING_CATEGORIES.HEALTH,
] as const;

export const DOCUMENT_CLASSIFICATIONS = {
  GENERIC: "GENERIC",
  PERSONALITY_DEVELOPMENT_REPORT: "PERSONALITY_DEVELOPMENT_REPORT",
} as const;

export type DocumentClassificationValue =
  (typeof DOCUMENT_CLASSIFICATIONS)[keyof typeof DOCUMENT_CLASSIFICATIONS];

/**
 * Document classifications that are disabled by default and require explicit
 * per-scope activation (R4-010).
 */
export const RESTRICTED_DOCUMENT_CLASSIFICATIONS = [
  DOCUMENT_CLASSIFICATIONS.PERSONALITY_DEVELOPMENT_REPORT,
] as const;
