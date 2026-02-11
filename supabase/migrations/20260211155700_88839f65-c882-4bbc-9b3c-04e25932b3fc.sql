
ALTER TABLE public.tasks ADD COLUMN buffer_days integer NOT NULL DEFAULT 0;
ALTER TABLE public.tasks ADD COLUMN buffer_position text NOT NULL DEFAULT 'end';
