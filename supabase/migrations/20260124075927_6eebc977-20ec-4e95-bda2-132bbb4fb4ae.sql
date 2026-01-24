-- 更新日程表的SELECT策略，允许所有人查看日程
DROP POLICY IF EXISTS "Authenticated users can view schedules" ON schedules;

CREATE POLICY "Anyone can view schedules" 
ON schedules 
FOR SELECT 
USING (true);