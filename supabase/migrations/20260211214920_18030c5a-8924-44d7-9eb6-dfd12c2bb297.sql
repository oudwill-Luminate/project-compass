
-- Create checklist_items table
CREATE TABLE public.checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  checked BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Members can view checklist items"
ON public.checklist_items FOR SELECT
USING (is_project_member(auth.uid(), get_project_id_from_task(task_id)));

CREATE POLICY "Editors can insert checklist items"
ON public.checklist_items FOR INSERT
WITH CHECK (is_project_editor(auth.uid(), get_project_id_from_task(task_id)));

CREATE POLICY "Editors can update checklist items"
ON public.checklist_items FOR UPDATE
USING (is_project_editor(auth.uid(), get_project_id_from_task(task_id)));

CREATE POLICY "Editors can delete checklist items"
ON public.checklist_items FOR DELETE
USING (is_project_editor(auth.uid(), get_project_id_from_task(task_id)));
