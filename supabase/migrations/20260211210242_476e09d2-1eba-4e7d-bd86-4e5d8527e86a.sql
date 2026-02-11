
-- Create enum for risk action types
CREATE TYPE public.risk_action_type AS ENUM ('mitigation', 'contingency');

-- Table for mitigation strategies and contingency plans per task
CREATE TABLE public.risk_actions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  action_type risk_action_type NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.risk_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view risk actions"
  ON public.risk_actions FOR SELECT
  USING (is_project_member(auth.uid(), get_project_id_from_task(task_id)));

CREATE POLICY "Editors can insert risk actions"
  ON public.risk_actions FOR INSERT
  WITH CHECK (is_project_editor(auth.uid(), get_project_id_from_task(task_id)));

CREATE POLICY "Editors can update risk actions"
  ON public.risk_actions FOR UPDATE
  USING (is_project_editor(auth.uid(), get_project_id_from_task(task_id)));

CREATE POLICY "Editors can delete risk actions"
  ON public.risk_actions FOR DELETE
  USING (is_project_editor(auth.uid(), get_project_id_from_task(task_id)));

-- Trigger for updated_at
CREATE TRIGGER update_risk_actions_updated_at
  BEFORE UPDATE ON public.risk_actions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
