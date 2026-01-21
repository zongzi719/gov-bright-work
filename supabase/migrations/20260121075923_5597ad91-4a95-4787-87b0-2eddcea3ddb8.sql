-- 创建人员状态枚举
CREATE TYPE public.contact_status AS ENUM ('on_duty', 'out', 'leave', 'business_trip', 'meeting');

-- 添加状态字段到联系人表
ALTER TABLE public.contacts ADD COLUMN status public.contact_status NOT NULL DEFAULT 'on_duty';

-- 添加状态备注字段（用于说明外出原因、请假时间等）
ALTER TABLE public.contacts ADD COLUMN status_note TEXT;