
-- Add show_in_nav column to control whether template appears in homepage Quick Links
ALTER TABLE public.approval_templates 
ADD COLUMN IF NOT EXISTS show_in_nav boolean NOT NULL DEFAULT false;

-- Set existing built-in templates to show in nav by default
UPDATE public.approval_templates SET show_in_nav = true 
WHERE code IN ('PROC_MKSAQYT6', 'PROC_MKTO1ET3', 'PROC_MKUK42R1', 'PROC_MKXWIEG6', 'PROC_MKXVX9VE', 'PROC_MKYO60ON');
