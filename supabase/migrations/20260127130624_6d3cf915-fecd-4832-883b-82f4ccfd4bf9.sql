-- 添加允许任何人插入absence_records的策略
CREATE POLICY "Anyone can insert absence records"
ON public.absence_records
FOR INSERT
WITH CHECK (true);

-- 添加允许任何人更新absence_records的策略
CREATE POLICY "Anyone can update absence records"
ON public.absence_records
FOR UPDATE
USING (true);