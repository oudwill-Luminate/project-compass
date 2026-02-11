
ALTER TABLE public.risk_actions
  ADD COLUMN owner_id uuid DEFAULT NULL,
  ADD COLUMN due_date date DEFAULT NULL;
