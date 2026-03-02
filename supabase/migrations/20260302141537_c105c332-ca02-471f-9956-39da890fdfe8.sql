
-- 添加 rmsid 字段到 contacts 表，用于单点登录用户匹配
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS rmsid text;

-- 创建唯一索引（rmsid 可为空，但非空值必须唯一）
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_rmsid ON public.contacts (rmsid) WHERE rmsid IS NOT NULL;
