-- Restrict platform support operations to support_elevations only.
DROP POLICY "support_elevations_tenant_isolation" ON "support_elevations";

CREATE POLICY "support_elevations_tenant_isolation" ON "support_elevations" AS PERMISSIVE FOR ALL TO admission_app
  USING (
    "tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID
    OR (
      current_setting('admission.platform_operation', true) = 'support_elevation'
      AND "tenant_id" = NULLIF(current_setting('admission.platform_target_tenant_id', true), '')::UUID
      AND "actor_user_id" = NULLIF(current_setting('admission.platform_actor_id', true), '')::UUID
    )
  )
  WITH CHECK (
    "tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID
    OR (
      current_setting('admission.platform_operation', true) = 'support_elevation'
      AND "tenant_id" = NULLIF(current_setting('admission.platform_target_tenant_id', true), '')::UUID
      AND "actor_user_id" = NULLIF(current_setting('admission.platform_actor_id', true), '')::UUID
    )
  );
