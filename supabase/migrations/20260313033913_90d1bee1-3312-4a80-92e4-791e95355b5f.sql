
CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  operator_id text NOT NULL,
  operator_name text NOT NULL,
  operator_role text,
  action text NOT NULL,
  module text NOT NULL,
  target_type text,
  target_id text,
  target_name text,
  detail jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_operator_id ON public.audit_logs (operator_id);
CREATE INDEX idx_audit_logs_module ON public.audit_logs (module);
CREATE INDEX idx_audit_logs_action ON public.audit_logs (action);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_admin and admin can view audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::text) OR has_role(auth.uid(), 'audit_admin'::text));

CREATE POLICY "Authenticated users can insert audit logs"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Anon can insert audit logs"
  ON public.audit_logs FOR INSERT TO anon
  WITH CHECK (true);
