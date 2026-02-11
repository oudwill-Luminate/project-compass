
ALTER TABLE public.buckets ADD COLUMN description TEXT NOT NULL DEFAULT '';
ALTER TABLE public.buckets ADD COLUMN owner_id UUID DEFAULT NULL;
