
-- 重建触发器
DROP TRIGGER IF EXISTS trg_check_three_officer_exclusivity ON public.user_roles;
DROP TRIGGER IF EXISTS trg_admin_toggle_after_insert ON public.user_roles;
DROP TRIGGER IF EXISTS trg_admin_toggle_after_delete ON public.user_roles;

CREATE TRIGGER trg_check_three_officer_exclusivity
  BEFORE INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_three_officer_exclusivity();

CREATE TRIGGER trg_admin_toggle_after_insert
  AFTER INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_admin_auto_toggle();

CREATE TRIGGER trg_admin_toggle_after_delete
  AFTER DELETE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_admin_auto_toggle();
