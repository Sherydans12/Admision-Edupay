export const PERMISSIONS = {
  APPLICATION_DECIDE: "application.decide",
  APPLICATION_READ: "application.read",
  APPLICATION_RECOMMEND: "application.recommend",
  CAPACITY_MANAGE: "capacity.manage",
  PLATFORM_SUPPORT_ELEVATE: "platform.support.elevate",
  RESTRICTED_READ: "restricted.read",
  WAITLIST_PROMOTE: "waitlist.promote",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const SENSITIVITIES = {
  HIGHLY_RESTRICTED: "highly_restricted",
  INTERNAL: "internal",
  RESTRICTED: "restricted",
} as const;

export type Sensitivity = (typeof SENSITIVITIES)[keyof typeof SENSITIVITIES];
