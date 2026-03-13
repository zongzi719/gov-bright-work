
CREATE OR REPLACE FUNCTION public.verify_admin_login(p_account text, p_password text)
RETURNS TABLE(
  contact_id uuid,
  contact_name text,
  contact_email text,
  contact_mobile text,
  contact_roles text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.email,
    c.mobile,
    ARRAY(
      SELECT ur.role FROM public.user_roles ur 
      WHERE ur.user_id = c.id 
      AND ur.role IN ('admin', 'sys_admin', 'security_admin', 'audit_admin')
    ) as roles
  FROM public.contacts c
  WHERE (c.email = p_account OR c.mobile = p_account)
    AND c.password_hash = p_password
    AND c.is_active = true;
END;
$$;
