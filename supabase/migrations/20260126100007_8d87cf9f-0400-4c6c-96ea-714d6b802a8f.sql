-- 为联系人表添加密级、是否领导、首次参加工作时间字段
ALTER TABLE public.contacts 
ADD COLUMN security_level text NOT NULL DEFAULT '一般',
ADD COLUMN is_leader boolean NOT NULL DEFAULT false,
ADD COLUMN first_work_date date;

-- 为通知公告表添加密级字段
ALTER TABLE public.notices 
ADD COLUMN security_level text NOT NULL DEFAULT '一般';

-- 添加字段注释
COMMENT ON COLUMN public.contacts.security_level IS '密级：机密、秘密、一般';
COMMENT ON COLUMN public.contacts.is_leader IS '是否领导';
COMMENT ON COLUMN public.contacts.first_work_date IS '首次参加工作时间，用于计算年假';
COMMENT ON COLUMN public.notices.security_level IS '密级：机密、秘密、一般';