
-- Fix bootstrap ownership creation: allow inserting the very first owner membership
-- when the project was created by the same user.

DROP POLICY IF EXISTS "Owners can add members" ON public.project_members;

CREATE POLICY "Owners can add members"
ON public.project_members
FOR INSERT
TO authenticated
WITH CHECK (
  -- normal path: existing owners can add members
  is_project_owner(auth.uid(), project_id)
  OR
  -- bootstrap path: project creator can be inserted as the initial owner
  (
    user_id = auth.uid()
    AND role = 'owner'
    AND EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_members.project_id
        AND p.created_by = auth.uid()
    )
  )
);
