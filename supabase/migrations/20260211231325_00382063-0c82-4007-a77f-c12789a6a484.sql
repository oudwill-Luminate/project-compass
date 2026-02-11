
CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view activity logs"
  ON public.activity_log FOR SELECT
  USING (is_project_member(auth.uid(), project_id));

CREATE POLICY "Editors can insert activity logs"
  ON public.activity_log FOR INSERT
  WITH CHECK (is_project_editor(auth.uid(), project_id));

CREATE INDEX idx_activity_log_project ON public.activity_log(project_id, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_log;
