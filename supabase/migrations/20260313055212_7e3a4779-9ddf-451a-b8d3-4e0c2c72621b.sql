
-- Drop existing SELECT policy
DROP POLICY IF EXISTS "audit_admin and admin can view audit logs" ON public.audit_logs;

-- Admin can see ALL logs
CREATE POLICY "admin can view all audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::text));

-- security_admin can see logs of regular users (no admin role) + audit_admin
CREATE POLICY "security_admin can view user and audit_admin logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'security_admin'::text)
  AND (
    operator_role IS NULL
    OR operator_role NOT IN ('admin', 'security_admin', 'sys_admin')
  )
);

-- audit_admin can see logs of security_admin + sys_admin
CREATE POLICY "audit_admin can view security_and_sys_admin logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'audit_admin'::text)
  AND operator_role IN ('security_admin', 'sys_admin')
);
