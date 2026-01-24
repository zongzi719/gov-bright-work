-- 添加 col_span 字段到 approval_form_fields 表，用于控制字段在表单中的布局宽度
ALTER TABLE public.approval_form_fields 
ADD COLUMN IF NOT EXISTS col_span integer NOT NULL DEFAULT 2;

-- 添加注释
COMMENT ON COLUMN public.approval_form_fields.col_span IS '字段占用的列数：1=半行，2=整行';