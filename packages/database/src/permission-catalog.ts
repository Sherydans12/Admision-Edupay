export const PERMISSIONS = {
  ADMISSION_CONFIG_MANAGE: "admission.config.manage",
  ADMISSION_CONFIG_READ: "admission.config.read",
  APPLICATION_DECIDE: "application.decide",
  APPLICATION_CREATE: "application.create",
  APPLICATION_ASSIST: "application.assist",
  APPLICATION_READ: "application.read",
  APPLICATION_RECOMMEND: "application.recommend",
  APPLICATION_SUBMIT: "application.submit",
  APPLICATION_WRITE: "application.write",
  CAPACITY_MANAGE: "capacity.manage",
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
  OFFERING_PUBLIC_READ: "offering.public.read",
  PLATFORM_SUPPORT_ELEVATE: "platform.support.elevate",
  RESTRICTED_READ: "restricted.read",
  STUDENT_READ: "student.read",
  STUDENT_WRITE: "student.write",
  WAITLIST_PROMOTE: "waitlist.promote",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const SENSITIVITIES = {
  HIGHLY_RESTRICTED: "highly_restricted",
  INTERNAL: "internal",
  RESTRICTED: "restricted",
} as const;

export type Sensitivity = (typeof SENSITIVITIES)[keyof typeof SENSITIVITIES];
