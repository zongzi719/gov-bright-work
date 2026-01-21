-- 创建单位/部门表
CREATE TABLE public.organizations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    short_name TEXT,
    parent_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    level INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    address TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 创建联系人表
CREATE TABLE public.contacts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    position TEXT,
    department TEXT,
    phone TEXT,
    mobile TEXT,
    email TEXT,
    office_location TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 启用 RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- 创建索引
CREATE INDEX idx_organizations_parent_id ON public.organizations(parent_id);
CREATE INDEX idx_organizations_name ON public.organizations(name);
CREATE INDEX idx_contacts_organization_id ON public.contacts(organization_id);
CREATE INDEX idx_contacts_name ON public.contacts(name);
CREATE INDEX idx_contacts_phone ON public.contacts(phone);
CREATE INDEX idx_contacts_mobile ON public.contacts(mobile);

-- RLS 策略：管理员可以管理所有数据
CREATE POLICY "Admins can manage organizations" ON public.organizations
FOR ALL USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage contacts" ON public.contacts
FOR ALL USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- 公开查看策略：已登录用户可以查看
CREATE POLICY "Authenticated users can view organizations" ON public.organizations
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view active contacts" ON public.contacts
FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);

-- 更新时间戳触发器
CREATE TRIGGER update_organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at
BEFORE UPDATE ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();