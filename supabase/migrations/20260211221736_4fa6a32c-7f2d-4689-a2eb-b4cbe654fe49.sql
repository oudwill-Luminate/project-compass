
CREATE TYPE public.engagement_level AS ENUM ('unaware', 'resistant', 'neutral', 'supportive', 'leading');

CREATE TABLE public.stakeholders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT '',
  power integer NOT NULL DEFAULT 3 CHECK (power >= 1 AND power <= 5),
  interest integer NOT NULL DEFAULT 3 CHECK (interest >= 1 AND interest <= 5),
  engagement engagement_level NOT NULL DEFAULT 'neutral',
  communication_plan text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stakeholders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view stakeholders" ON public.stakeholders
  FOR SELECT USING (is_project_member(auth.uid(), project_id));
CREATE POLICY "Editors can insert stakeholders" ON public.stakeholders
  FOR INSERT WITH CHECK (is_project_editor(auth.uid(), project_id));
CREATE POLICY "Editors can update stakeholders" ON public.stakeholders
  FOR UPDATE USING (is_project_editor(auth.uid(), project_id));
CREATE POLICY "Editors can delete stakeholders" ON public.stakeholders
  FOR DELETE USING (is_project_editor(auth.uid(), project_id));

ALTER PUBLICATION supabase_realtime ADD TABLE public.stakeholders;
