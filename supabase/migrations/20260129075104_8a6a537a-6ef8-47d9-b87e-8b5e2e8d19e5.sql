-- 为 absence_records 表添加删除策略（允许管理员删除）
CREATE POLICY "Admins can delete absence records"
ON public.absence_records
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 为 approval_instances 表添加删除策略（允许管理员删除）
CREATE POLICY "Admins can delete approval instances"
ON public.approval_instances
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 为 approval_records 表添加删除策略（允许管理员删除）
CREATE POLICY "Admins can delete approval records"
ON public.approval_records
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 为 todo_items 表添加删除策略（允许管理员删除）
CREATE POLICY "Admins can delete todo items"
ON public.todo_items
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));