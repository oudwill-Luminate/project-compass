
-- Create enum types
CREATE TYPE public.project_role AS ENUM ('owner', 'editor', 'viewer');
CREATE TYPE public.task_status AS ENUM ('done', 'working', 'stuck', 'not-started');
CREATE TYPE public.task_priority AS ENUM ('critical', 'high', 'medium', 'low');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  job_title TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contingency_percent NUMERIC NOT NULL DEFAULT 10,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Project members (access control)
CREATE TABLE public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.project_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Buckets (task groups)
CREATE TABLE public.buckets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#0073EA',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.buckets ENABLE ROW LEVEL SECURITY;

-- Tasks
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id UUID NOT NULL REFERENCES public.buckets(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status public.task_status NOT NULL DEFAULT 'not-started',
  priority public.task_priority NOT NULL DEFAULT 'medium',
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE NOT NULL DEFAULT CURRENT_DATE + 7,
  estimated_cost NUMERIC NOT NULL DEFAULT 0,
  actual_cost NUMERIC NOT NULL DEFAULT 0,
  depends_on UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  flagged_as_risk BOOLEAN NOT NULL DEFAULT false,
  risk_impact INTEGER NOT NULL DEFAULT 1,
  risk_probability INTEGER NOT NULL DEFAULT 1,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- ========== HELPER FUNCTIONS (SECURITY DEFINER) ==========

-- Check project membership
CREATE OR REPLACE FUNCTION public.is_project_member(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE user_id = _user_id AND project_id = _project_id
  )
$$;

-- Check if user is owner
CREATE OR REPLACE FUNCTION public.is_project_owner(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE user_id = _user_id AND project_id = _project_id AND role = 'owner'
  )
$$;

-- Check if user is editor or owner
CREATE OR REPLACE FUNCTION public.is_project_editor(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE user_id = _user_id AND project_id = _project_id AND role IN ('owner', 'editor')
  )
$$;

-- Get project_id from bucket_id
CREATE OR REPLACE FUNCTION public.get_project_id_from_bucket(_bucket_id UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT project_id FROM public.buckets WHERE id = _bucket_id
$$;

-- Get project_id from task_id (via bucket)
CREATE OR REPLACE FUNCTION public.get_project_id_from_task(_task_id UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.project_id FROM public.tasks t
  JOIN public.buckets b ON t.bucket_id = b.id
  WHERE t.id = _task_id
$$;

-- ========== RLS POLICIES ==========

-- Profiles: authenticated users can read all, users can update own
CREATE POLICY "Anyone authenticated can view profiles"
  ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- Projects: members can read, owners can update/delete, authenticated can insert
CREATE POLICY "Members can view projects"
  ON public.projects FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), id));
CREATE POLICY "Authenticated users can create projects"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "Owners can update projects"
  ON public.projects FOR UPDATE TO authenticated
  USING (public.is_project_owner(auth.uid(), id));
CREATE POLICY "Owners can delete projects"
  ON public.projects FOR DELETE TO authenticated
  USING (public.is_project_owner(auth.uid(), id));

-- Project members: members can read their project's members, owners manage
CREATE POLICY "Members can view project members"
  ON public.project_members FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));
CREATE POLICY "Owners can add members"
  ON public.project_members FOR INSERT TO authenticated
  WITH CHECK (public.is_project_owner(auth.uid(), project_id));
CREATE POLICY "Owners can update members"
  ON public.project_members FOR UPDATE TO authenticated
  USING (public.is_project_owner(auth.uid(), project_id));
CREATE POLICY "Owners can remove members"
  ON public.project_members FOR DELETE TO authenticated
  USING (public.is_project_owner(auth.uid(), project_id) AND user_id != auth.uid());

-- Buckets: members can read, editors+ can modify
CREATE POLICY "Members can view buckets"
  ON public.buckets FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));
CREATE POLICY "Editors can create buckets"
  ON public.buckets FOR INSERT TO authenticated
  WITH CHECK (public.is_project_editor(auth.uid(), project_id));
CREATE POLICY "Editors can update buckets"
  ON public.buckets FOR UPDATE TO authenticated
  USING (public.is_project_editor(auth.uid(), project_id));
CREATE POLICY "Editors can delete buckets"
  ON public.buckets FOR DELETE TO authenticated
  USING (public.is_project_editor(auth.uid(), project_id));

-- Tasks: access through bucket -> project membership
CREATE POLICY "Members can view tasks"
  ON public.tasks FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), public.get_project_id_from_bucket(bucket_id)));
CREATE POLICY "Editors can create tasks"
  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (public.is_project_editor(auth.uid(), public.get_project_id_from_bucket(bucket_id)));
CREATE POLICY "Editors can update tasks"
  ON public.tasks FOR UPDATE TO authenticated
  USING (public.is_project_editor(auth.uid(), public.get_project_id_from_bucket(bucket_id)));
CREATE POLICY "Editors can delete tasks"
  ON public.tasks FOR DELETE TO authenticated
  USING (public.is_project_editor(auth.uid(), public.get_project_id_from_bucket(bucket_id)));

-- ========== TRIGGERS ==========

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-add creator as owner when project is created
CREATE OR REPLACE FUNCTION public.handle_new_project()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_project_created
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_project();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_buckets_updated_at BEFORE UPDATE ON public.buckets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== STORAGE ==========

INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Enable realtime for collaborative editing
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.buckets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
