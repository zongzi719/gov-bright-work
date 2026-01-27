-- 创建自动更新联系人状态的函数
-- 根据 absence_records 的 start_time 和 end_time 自动更新 contacts 的状态

CREATE OR REPLACE FUNCTION public.sync_contact_status()
RETURNS TABLE(updated_count integer, details jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_updated_count integer := 0;
  v_details jsonb := '[]'::jsonb;
  v_now timestamptz := now();
  rec RECORD;
BEGIN
  -- 1. 将已过结束时间的请假/外出/出差人员状态恢复为"在职"
  FOR rec IN
    SELECT DISTINCT c.id as contact_id, c.name, c.status
    FROM contacts c
    WHERE c.status IN ('leave', 'out', 'business_trip')
    AND NOT EXISTS (
      -- 确保没有任何正在进行中的请假/外出/出差
      SELECT 1 FROM absence_records ar
      INNER JOIN approval_instances ai ON ai.business_id = ar.id AND ai.business_type = 'absence'
      WHERE ar.contact_id = c.id
        AND ar.status = 'approved'
        AND ai.status = 'approved'
        AND ar.start_time <= v_now
        AND (ar.end_time IS NULL OR ar.end_time > v_now)
    )
  LOOP
    UPDATE contacts SET status = 'on_duty', status_note = NULL, updated_at = now()
    WHERE id = rec.contact_id;
    
    v_updated_count := v_updated_count + 1;
    v_details := v_details || jsonb_build_object(
      'contact_id', rec.contact_id,
      'name', rec.name,
      'old_status', rec.status,
      'new_status', 'on_duty',
      'action', 'restored'
    );
  END LOOP;
  
  -- 2. 将当前正在请假/外出/出差的人员状态更新
  FOR rec IN
    SELECT 
      ar.contact_id,
      ar.type,
      ar.reason,
      c.name,
      c.status as current_status
    FROM absence_records ar
    INNER JOIN approval_instances ai ON ai.business_id = ar.id AND ai.business_type = 'absence'
    INNER JOIN contacts c ON c.id = ar.contact_id
    WHERE ar.status = 'approved'
      AND ai.status = 'approved'
      AND ar.start_time <= v_now
      AND (ar.end_time IS NULL OR ar.end_time > v_now)
      AND c.status = 'on_duty' -- 只更新当前在职的
    ORDER BY ar.start_time DESC
  LOOP
    UPDATE contacts 
    SET status = rec.type::contact_status, 
        status_note = rec.reason,
        updated_at = now()
    WHERE id = rec.contact_id;
    
    v_updated_count := v_updated_count + 1;
    v_details := v_details || jsonb_build_object(
      'contact_id', rec.contact_id,
      'name', rec.name,
      'old_status', rec.current_status,
      'new_status', rec.type,
      'action', 'activated'
    );
  END LOOP;
  
  RETURN QUERY SELECT v_updated_count, v_details;
END;
$function$;

-- 授权任何已认证用户可以执行该函数
GRANT EXECUTE ON FUNCTION public.sync_contact_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_contact_status() TO anon;