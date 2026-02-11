
-- Add sentiment and last_communication_date to stakeholders
ALTER TABLE public.stakeholders
  ADD COLUMN sentiment text NOT NULL DEFAULT 'neutral',
  ADD COLUMN last_communication_date date DEFAULT NULL;

-- Create communication_logs table
CREATE TABLE public.communication_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stakeholder_id uuid NOT NULL REFERENCES public.stakeholders(id) ON DELETE CASCADE,
  note text NOT NULL DEFAULT '',
  logged_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;

-- RLS: use helper to resolve project from stakeholder
CREATE OR REPLACE FUNCTION public.get_project_id_from_stakeholder(_stakeholder_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT project_id FROM public.stakeholders WHERE id = _stakeholder_id
$$;

CREATE POLICY "Members can view communication logs"
  ON public.communication_logs FOR SELECT
  USING (is_project_member(auth.uid(), get_project_id_from_stakeholder(stakeholder_id)));

CREATE POLICY "Editors can insert communication logs"
  ON public.communication_logs FOR INSERT
  WITH CHECK (is_project_editor(auth.uid(), get_project_id_from_stakeholder(stakeholder_id)));

CREATE POLICY "Editors can update communication logs"
  ON public.communication_logs FOR UPDATE
  USING (is_project_editor(auth.uid(), get_project_id_from_stakeholder(stakeholder_id)));

CREATE POLICY "Editors can delete communication logs"
  ON public.communication_logs FOR DELETE
  USING (is_project_editor(auth.uid(), get_project_id_from_stakeholder(stakeholder_id)));
