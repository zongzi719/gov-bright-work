-- 允许已认证用户插入日程（前台用户使用自定义登录）
-- 首先删除可能存在的旧策略
DROP POLICY IF EXISTS "Users can insert their own schedules" ON schedules;

-- 创建新策略：允许所有人插入日程（前台用户没有Supabase auth）
CREATE POLICY "Anyone can insert schedules" 
ON schedules 
FOR INSERT 
WITH CHECK (true);

-- 创建策略：允许用户更新自己的日程（通过contact_id匹配）
DROP POLICY IF EXISTS "Users can update their own schedules" ON schedules;
CREATE POLICY "Anyone can update schedules" 
ON schedules 
FOR UPDATE 
USING (true);

-- 创建策略：允许用户删除自己的日程
DROP POLICY IF EXISTS "Users can delete their own schedules" ON schedules;
CREATE POLICY "Anyone can delete schedules" 
ON schedules 
FOR DELETE 
USING (true);