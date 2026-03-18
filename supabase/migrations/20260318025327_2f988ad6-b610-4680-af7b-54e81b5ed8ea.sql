CREATE TABLE public.external_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  icon_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.external_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active external links"
ON public.external_links FOR SELECT TO public
USING (is_active = true);

CREATE POLICY "Admins can manage external links"
ON public.external_links FOR ALL TO public
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "sys_admin can manage external_links"
ON public.external_links FOR ALL TO public
USING (has_role(auth.uid(), 'sys_admin'::text))
WITH CHECK (has_role(auth.uid(), 'sys_admin'::text));