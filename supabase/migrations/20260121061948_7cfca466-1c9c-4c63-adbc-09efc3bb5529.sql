-- 创建角色枚举
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- 创建用户角色表
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- 启用RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 创建角色检查函数
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 用户角色RLS策略
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- 轮播图表
CREATE TABLE public.banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_url TEXT NOT NULL,
    title TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

-- 轮播图公开可读
CREATE POLICY "Anyone can view active banners"
ON public.banners
FOR SELECT
USING (is_active = true);

-- 管理员可管理轮播图
CREATE POLICY "Admins can manage banners"
ON public.banners
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 通知公告表
CREATE TABLE public.notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    department TEXT NOT NULL,
    content TEXT,
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    is_published BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

-- 公告公开可读
CREATE POLICY "Anyone can view published notices"
ON public.notices
FOR SELECT
USING (is_published = true);

-- 管理员可管理公告
CREATE POLICY "Admins can manage notices"
ON public.notices
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 食堂菜谱表
CREATE TABLE public.canteen_menus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    breakfast TEXT[] NOT NULL DEFAULT '{}',
    lunch TEXT[] NOT NULL DEFAULT '{}',
    dinner TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (day_of_week)
);

ALTER TABLE public.canteen_menus ENABLE ROW LEVEL SECURITY;

-- 菜谱公开可读
CREATE POLICY "Anyone can view menus"
ON public.canteen_menus
FOR SELECT
USING (true);

-- 管理员可管理菜谱
CREATE POLICY "Admins can manage menus"
ON public.canteen_menus
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 更新时间戳函数
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 添加触发器
CREATE TRIGGER update_banners_updated_at
BEFORE UPDATE ON public.banners
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notices_updated_at
BEFORE UPDATE ON public.notices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_canteen_menus_updated_at
BEFORE UPDATE ON public.canteen_menus
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 插入默认轮播图数据
INSERT INTO public.banners (image_url, title, sort_order) VALUES
('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1920&h=400&fit=crop', '深入学习贯彻党的二十大精神，奋力开创高质量发展新局面', 1),
('https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1920&h=400&fit=crop', '全面推进数字政府建设，提升政务服务效能', 2),
('https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1920&h=400&fit=crop', '坚持以人民为中心，持续优化营商环境', 3);

-- 插入默认通知公告
INSERT INTO public.notices (title, department, is_pinned) VALUES
('关于2025年工作总结报送的通知', '综合科', true),
('关于开展节前安全大检查的通知', '安保部', false),
('关于更新办公系统操作手册的通知', '信息科', false),
('关于组织参加消防安全培训的通知', '安保部', false),
('关于调整办公区域供暖时间的通知', '行政部', false);

-- 插入默认菜谱
INSERT INTO public.canteen_menus (day_of_week, breakfast, lunch, dinner) VALUES
(0, ARRAY['豆浆', '油条', '包子', '鸡蛋', '小米粥'], ARRAY['红烧排骨', '清炒西兰花', '番茄炒蛋', '米饭', '紫菜蛋花汤'], ARRAY['炸酱面', '凉拌黄瓜', '卤鸡腿', '绿豆粥']),
(1, ARRAY['牛奶', '面包', '煎蛋', '玉米', '八宝粥'], ARRAY['糖醋里脊', '蒜蓉油麦菜', '宫保鸡丁', '米饭', '酸辣汤'], ARRAY['牛肉面', '拍黄瓜', '红烧鱼块', '小米粥']),
(2, ARRAY['豆浆', '油条', '包子', '鸡蛋', '小米粥'], ARRAY['红烧排骨', '清炒西兰花', '番茄炒蛋', '米饭', '紫菜蛋花汤'], ARRAY['炸酱面', '凉拌黄瓜', '卤鸡腿', '绿豆粥']),
(3, ARRAY['牛奶', '馒头', '咸菜', '鸡蛋', '南瓜粥'], ARRAY['回锅肉', '炒青菜', '麻婆豆腐', '米饭', '西红柿汤'], ARRAY['担担面', '凉拌木耳', '可乐鸡翅', '玉米粥']),
(4, ARRAY['豆浆', '肉包', '花卷', '鸡蛋', '燕麦粥'], ARRAY['鱼香肉丝', '蒜蓉菠菜', '土豆丝', '米饭', '冬瓜汤'], ARRAY['阳春面', '凉拌海带', '红烧肉', '红豆粥']);