
-- Drop all existing RESTRICTIVE policies and recreate as PERMISSIVE

-- projects
DROP POLICY IF EXISTS "Authenticated users can create projects" ON public.projects;
DROP POLICY IF EXISTS "Members can view projects" ON public.projects;
DROP POLICY IF EXISTS "Owners can delete projects" ON public.projects;
DROP POLICY IF EXISTS "Owners can update projects" ON public.projects;

CREATE POLICY "Authenticated users can create projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Members can view projects" ON public.projects FOR SELECT TO authenticated USING (is_project_member(auth.uid(), id));
CREATE POLICY "Owners can delete projects" ON public.projects FOR DELETE TO authenticated USING (is_project_owner(auth.uid(), id));
CREATE POLICY "Owners can update projects" ON public.projects FOR UPDATE TO authenticated USING (is_project_owner(auth.uid(), id));

-- profiles
DROP POLICY IF EXISTS "Anyone authenticated can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Anyone authenticated can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- project_members
DROP POLICY IF EXISTS "Members can view project members" ON public.project_members;
DROP POLICY IF EXISTS "Owners can add members" ON public.project_members;
DROP POLICY IF EXISTS "Owners can remove members" ON public.project_members;
DROP POLICY IF EXISTS "Owners can update members" ON public.project_members;

CREATE POLICY "Members can view project members" ON public.project_members FOR SELECT TO authenticated USING (is_project_member(auth.uid(), project_id));
CREATE POLICY "Owners can add members" ON public.project_members FOR INSERT TO authenticated WITH CHECK (is_project_owner(auth.uid(), project_id));
CREATE POLICY "Owners can remove members" ON public.project_members FOR DELETE TO authenticated USING (is_project_owner(auth.uid(), project_id) AND user_id <> auth.uid());
CREATE POLICY "Owners can update members" ON public.project_members FOR UPDATE TO authenticated USING (is_project_owner(auth.uid(), project_id));

-- buckets
DROP POLICY IF EXISTS "Editors can create buckets" ON public.buckets;
DROP POLICY IF EXISTS "Editors can delete buckets" ON public.buckets;
DROP POLICY IF EXISTS "Editors can update buckets" ON public.buckets;
DROP POLICY IF EXISTS "Members can view buckets" ON public.buckets;

CREATE POLICY "Editors can create buckets" ON public.buckets FOR INSERT TO authenticated WITH CHECK (is_project_editor(auth.uid(), project_id));
CREATE POLICY "Editors can delete buckets" ON public.buckets FOR DELETE TO authenticated USING (is_project_editor(auth.uid(), project_id));
CREATE POLICY "Editors can update buckets" ON public.buckets FOR UPDATE TO authenticated USING (is_project_editor(auth.uid(), project_id));
CREATE POLICY "Members can view buckets" ON public.buckets FOR SELECT TO authenticated USING (is_project_member(auth.uid(), project_id));

-- tasks
DROP POLICY IF EXISTS "Editors can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Editors can delete tasks" ON public.tasks;
DROP POLICY IF EXISTS "Editors can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Members can view tasks" ON public.tasks;

CREATE POLICY "Editors can create tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (is_project_editor(auth.uid(), get_project_id_from_bucket(bucket_id)));
CREATE POLICY "Editors can delete tasks" ON public.tasks FOR DELETE TO authenticated USING (is_project_editor(auth.uid(), get_project_id_from_bucket(bucket_id)));
CREATE POLICY "Editors can update tasks" ON public.tasks FOR UPDATE TO authenticated USING (is_project_editor(auth.uid(), get_project_id_from_bucket(bucket_id)));
CREATE POLICY "Members can view tasks" ON public.tasks FOR SELECT TO authenticated USING (is_project_member(auth.uid(), get_project_id_from_bucket(bucket_id)));
