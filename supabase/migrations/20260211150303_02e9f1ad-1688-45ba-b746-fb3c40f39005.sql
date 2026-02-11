
-- Allow project creators to see their own projects (needed for INSERT...RETURNING)
DROP POLICY IF EXISTS "Members can view projects" ON public.projects;

CREATE POLICY "Members can view projects"
ON public.projects
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR is_project_member(auth.uid(), id)
);
