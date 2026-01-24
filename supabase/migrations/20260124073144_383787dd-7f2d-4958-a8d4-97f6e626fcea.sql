-- 允许所有人查看活跃的办公用品（用于前台表单选择）
DROP POLICY IF EXISTS "Authenticated users can view office supplies" ON office_supplies;
CREATE POLICY "Anyone can view active office supplies" 
ON office_supplies 
FOR SELECT 
USING (is_active = true);