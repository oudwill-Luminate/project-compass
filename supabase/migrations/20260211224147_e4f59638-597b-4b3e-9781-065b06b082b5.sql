
-- Track sentiment changes over time
CREATE TABLE public.stakeholder_sentiment_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stakeholder_id uuid NOT NULL REFERENCES public.stakeholders(id) ON DELETE CASCADE,
  sentiment text NOT NULL DEFAULT 'neutral',
  recorded_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.stakeholder_sentiment_history ENABLE ROW LEVEL SECURITY;

-- RLS policies using existing helper
CREATE POLICY "Members can view sentiment history"
  ON public.stakeholder_sentiment_history FOR SELECT
  USING (is_project_member(auth.uid(), get_project_id_from_stakeholder(stakeholder_id)));

CREATE POLICY "Editors can insert sentiment history"
  ON public.stakeholder_sentiment_history FOR INSERT
  WITH CHECK (is_project_editor(auth.uid(), get_project_id_from_stakeholder(stakeholder_id)));

CREATE POLICY "Editors can delete sentiment history"
  ON public.stakeholder_sentiment_history FOR DELETE
  USING (is_project_editor(auth.uid(), get_project_id_from_stakeholder(stakeholder_id)));

-- Enable pg_cron and pg_net for scheduled reminders
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
