-- 删除限制性的Admin策略
DROP POLICY IF EXISTS "Admins can manage absence records" ON public.absence_records;

-- 重新创建为PERMISSIVE策略（允许admin管理所有记录）
CREATE POLICY "Admins can manage absence records"
ON public.absence_records
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 删除旧的INSERT策略并重建
DROP POLICY IF EXISTS "Anyone can insert absence records" ON public.absence_records;
CREATE POLICY "Anyone can insert absence records"
ON public.absence_records
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- 删除旧的UPDATE策略并重建  
DROP POLICY IF EXISTS "Anyone can update absence records" ON public.absence_records;
CREATE POLICY "Anyone can update absence records"
ON public.absence_records
FOR UPDATE
TO anon, authenticated
USING (true);

-- 更新SELECT策略允许匿名用户访问
DROP POLICY IF EXISTS "Authenticated users can view absence records" ON public.absence_records;
CREATE POLICY "Anyone can view absence records"
ON public.absence_records
FOR SELECT
TO anon, authenticated
USING (true);