-- Create a function for secure login verification
CREATE OR REPLACE FUNCTION public.verify_contact_login(p_mobile text, p_password text)
RETURNS TABLE (
  contact_id uuid,
  contact_name text,
  contact_mobile text,
  contact_position text,
  contact_department text,
  organization_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.mobile,
    c.position,
    c.department,
    o.name as organization_name
  FROM public.contacts c
  LEFT JOIN public.organizations o ON c.organization_id = o.id
  WHERE c.mobile = p_mobile 
    AND c.password_hash = p_password 
    AND c.is_active = true;
END;
$$;