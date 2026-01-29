-- 为通知公告添加发布范围字段
ALTER TABLE public.notices
ADD COLUMN publish_scope text NOT NULL DEFAULT 'all',
ADD COLUMN publish_scope_ids uuid[] DEFAULT '{}';

-- 添加注释
COMMENT ON COLUMN public.notices.publish_scope IS '发布范围：all=全部, organization=指定单位';
COMMENT ON COLUMN public.notices.publish_scope_ids IS '发布范围单位ID列表';