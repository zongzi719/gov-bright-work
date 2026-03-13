
-- 1. Insert three officer system roles
INSERT INTO public.roles (name, label, description, is_system, is_active, sort_order)
VALUES 
  ('sys_admin', '系统管理员', '负责系统日常运维管理：通讯录、通知公告、食堂菜谱、轮播图、日程、办公用品等', true, true, 1),
  ('security_admin', '安全保密管理员', '负责安全策略与权限管理：角色管理、角色用户分配、权限管理、审批流程', true, true, 2),
  ('audit_admin', '安全审计员', '负责审计日志查看与监督', true, true, 3)
ON CONFLICT (name) DO NOTHING;

-- 2. Mutual exclusivity trigger: prevent user from holding multiple three-officer roles
CREATE OR REPLACE FUNCTION public.check_three_officer_exclusivity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_three_roles text[] := ARRAY['sys_admin', 'security_admin', 'audit_admin'];
  v_existing_role text;
BEGIN
  IF NEW.role = ANY(v_three_roles) THEN
    SELECT role INTO v_existing_role
    FROM public.user_roles
    WHERE user_id = NEW.user_id
      AND role = ANY(v_three_roles)
      AND role != NEW.role
    LIMIT 1;
    IF v_existing_role IS NOT NULL THEN
      RAISE EXCEPTION '该用户已持有三员角色「%」，不可兼任', v_existing_role;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_three_officer_exclusivity ON public.user_roles;
CREATE TRIGGER trg_check_three_officer_exclusivity
  BEFORE INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_three_officer_exclusivity();

-- 3. Admin auto-toggle: disable admin when all three officers assigned, re-enable when not
CREATE OR REPLACE FUNCTION public.check_admin_auto_toggle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(DISTINCT role) INTO v_count
  FROM public.user_roles
  WHERE role IN ('sys_admin', 'security_admin', 'audit_admin');

  IF v_count >= 3 THEN
    UPDATE public.roles SET is_active = false, updated_at = now()
    WHERE name = 'admin' AND is_active = true;
  ELSE
    UPDATE public.roles SET is_active = true, updated_at = now()
    WHERE name = 'admin' AND is_active = false;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_admin_auto_toggle ON public.user_roles;
CREATE TRIGGER trg_check_admin_auto_toggle
  AFTER INSERT OR DELETE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_admin_auto_toggle();

-- 4. RLS: sys_admin can manage operational tables
DO $$ DECLARE
  t text;
  tables text[] := ARRAY[
    'banners', 'notices', 'notice_images', 'canteen_menus', 'contacts', 'organizations',
    'absence_records', 'leave_balances', 'office_supplies', 'stock_movements',
    'schedules', 'leader_schedules', 'leader_schedule_permissions',
    'supply_requisitions', 'supply_requisition_items',
    'purchase_requests', 'purchase_request_items',
    'supply_purchases', 'supply_purchase_items',
    'todo_items'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      EXECUTE format(
        'CREATE POLICY "sys_admin can manage %1$s" ON public.%1$I FOR ALL TO public USING (has_role(auth.uid(), ''sys_admin''::text)) WITH CHECK (has_role(auth.uid(), ''sys_admin''::text))',
        t
      );
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END LOOP;
END $$;

-- 5. RLS: security_admin can manage security/permission tables
DO $$ DECLARE
  t text;
  tables text[] := ARRAY[
    'roles', 'role_permissions', 'user_roles',
    'approval_templates', 'approval_nodes', 'approval_form_fields',
    'approval_process_versions', 'approval_instances', 'approval_records'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      EXECUTE format(
        'CREATE POLICY "security_admin can manage %1$s" ON public.%1$I FOR ALL TO public USING (has_role(auth.uid(), ''security_admin''::text)) WITH CHECK (has_role(auth.uid(), ''security_admin''::text))',
        t
      );
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END LOOP;
END $$;
