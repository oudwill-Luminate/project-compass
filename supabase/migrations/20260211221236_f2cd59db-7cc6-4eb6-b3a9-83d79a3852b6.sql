
ALTER TABLE public.profiles ADD COLUMN hourly_rate numeric NOT NULL DEFAULT 0;
ALTER TABLE public.projects ADD COLUMN charter_markdown text NOT NULL DEFAULT '';

CREATE TABLE public.project_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  progress integer NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view goals" ON public.project_goals
  FOR SELECT USING (is_project_member(auth.uid(), project_id));
CREATE POLICY "Editors can insert goals" ON public.project_goals
  FOR INSERT WITH CHECK (is_project_editor(auth.uid(), project_id));
CREATE POLICY "Editors can update goals" ON public.project_goals
  FOR UPDATE USING (is_project_editor(auth.uid(), project_id));
CREATE POLICY "Editors can delete goals" ON public.project_goals
  FOR DELETE USING (is_project_editor(auth.uid(), project_id));

ALTER PUBLICATION supabase_realtime ADD TABLE public.project_goals;
