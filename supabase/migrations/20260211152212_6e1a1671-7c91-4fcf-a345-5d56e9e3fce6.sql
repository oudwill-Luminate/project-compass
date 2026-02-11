
-- Add dependency type enum
CREATE TYPE public.dependency_type AS ENUM ('FS', 'FF', 'SS', 'SF');

-- Add dependency_type column with default FS (Finish-to-Start, most common)
ALTER TABLE public.tasks 
ADD COLUMN dependency_type public.dependency_type NOT NULL DEFAULT 'FS';
