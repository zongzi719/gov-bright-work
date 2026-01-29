-- 先删除旧函数，再创建新函数（增加返回 organization_id）
DROP FUNCTION IF EXISTS public.verify_contact_login(text, text);

CREATE FUNCTION public.verify_contact_login(p_mobile text, p_password text)
 RETURNS TABLE(contact_id uuid, contact_name text, contact_mobile text, contact_position text, contact_department text, organization_name text, contact_security_level text, contact_organization_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.mobile,
    c.position,
    c.department,
    o.name as organization_name,
    c.security_level as contact_security_level,
    c.organization_id as contact_organization_id
  FROM public.contacts c
  LEFT JOIN public.organizations o ON c.organization_id = o.id
  WHERE c.mobile = p_mobile 
    AND c.password_hash = p_password 
    AND c.is_active = true;
END;
$function$;