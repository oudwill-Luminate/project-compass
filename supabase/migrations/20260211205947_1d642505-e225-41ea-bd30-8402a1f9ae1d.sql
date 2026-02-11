
-- Table to store daily risk count snapshots per project
CREATE TABLE public.risk_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  critical_count integer NOT NULL DEFAULT 0,
  high_count integer NOT NULL DEFAULT 0,
  medium_count integer NOT NULL DEFAULT 0,
  low_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(project_id, snapshot_date)
);

ALTER TABLE public.risk_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view risk snapshots"
  ON public.risk_snapshots FOR SELECT
  USING (is_project_member(auth.uid(), project_id));

CREATE POLICY "Editors can insert risk snapshots"
  ON public.risk_snapshots FOR INSERT
  WITH CHECK (is_project_editor(auth.uid(), project_id));

CREATE POLICY "Editors can update risk snapshots"
  ON public.risk_snapshots FOR UPDATE
  USING (is_project_editor(auth.uid(), project_id));
