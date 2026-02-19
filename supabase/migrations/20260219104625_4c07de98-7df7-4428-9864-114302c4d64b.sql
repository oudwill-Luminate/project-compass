
-- Create junction table for multiple dependencies per task
CREATE TABLE public.task_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  predecessor_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  dependency_type public.dependency_type NOT NULL DEFAULT 'FS',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(task_id, predecessor_id),
  CHECK(task_id != predecessor_id)
);

-- Enable RLS
ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Members can view task dependencies"
  ON public.task_dependencies FOR SELECT
  USING (is_project_member(auth.uid(), get_project_id_from_task(task_id)));

CREATE POLICY "Editors can insert task dependencies"
  ON public.task_dependencies FOR INSERT
  WITH CHECK (is_project_editor(auth.uid(), get_project_id_from_task(task_id)));

CREATE POLICY "Editors can update task dependencies"
  ON public.task_dependencies FOR UPDATE
  USING (is_project_editor(auth.uid(), get_project_id_from_task(task_id)));

CREATE POLICY "Editors can delete task dependencies"
  ON public.task_dependencies FOR DELETE
  USING (is_project_editor(auth.uid(), get_project_id_from_task(task_id)));

-- Migrate existing single-dependency data
INSERT INTO public.task_dependencies (task_id, predecessor_id, dependency_type)
SELECT id, depends_on, dependency_type
FROM public.tasks
WHERE depends_on IS NOT NULL;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_dependencies;

-- Update cascade_task_dates to use junction table
CREATE OR REPLACE FUNCTION public.cascade_task_dates(
  _task_id uuid, _new_start date, _new_end date, _include_weekends boolean
)
RETURNS integer
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  queue UUID[] := ARRAY[_task_id];
  visited UUID[] := ARRAY[]::UUID[];
  processed INTEGER := 0;
  current_id UUID;
  pred_start DATE;
  pred_end DATE;
  pred_buffer INTEGER;
  pred_buffer_pos TEXT;
  dep RECORD;
  dep_duration INTEGER;
  eff_end DATE;
  eff_start DATE;
  new_s DATE;
  new_e DATE;
  -- For multi-predecessor logic
  other_pred RECORD;
  other_eff_end DATE;
  other_eff_start DATE;
  candidate_s DATE;
  final_s DATE;
BEGIN
  -- Update the root task
  UPDATE tasks SET start_date = _new_start, end_date = _new_end WHERE id = _task_id;

  WHILE array_length(queue, 1) > 0 LOOP
    current_id := queue[1];
    queue := queue[2:];

    IF current_id = ANY(visited) THEN CONTINUE; END IF;
    visited := visited || current_id;

    -- Get current task's dates for computing effective dates
    SELECT start_date, end_date, buffer_days, buffer_position
      INTO pred_start, pred_end, pred_buffer, pred_buffer_pos
      FROM tasks WHERE id = current_id;

    -- Compute effective dates with buffer for current predecessor
    IF pred_buffer_pos = 'end' THEN
      eff_end := add_working_days(pred_end, pred_buffer, _include_weekends);
      eff_start := pred_start;
    ELSE
      eff_end := pred_end;
      eff_start := add_working_days(pred_start, -pred_buffer, _include_weekends);
    END IF;

    -- Find all successors via junction table
    FOR dep IN
      SELECT td.task_id AS succ_id, td.dependency_type AS dep_type,
             t.start_date, t.end_date
      FROM task_dependencies td
      JOIN tasks t ON t.id = td.task_id
      WHERE td.predecessor_id = current_id
    LOOP
      dep_duration := working_days_diff(dep.start_date, dep.end_date, _include_weekends);

      -- Compute candidate start from THIS predecessor
      CASE dep.dep_type
        WHEN 'FS' THEN
          new_s := next_working_day(eff_end + 1, _include_weekends);
        WHEN 'FF' THEN
          new_s := add_working_days(eff_end, -dep_duration, _include_weekends);
        WHEN 'SS' THEN
          new_s := next_working_day(eff_start, _include_weekends);
        WHEN 'SF' THEN
          new_s := add_working_days(next_working_day(eff_start - 1, _include_weekends), -dep_duration, _include_weekends);
        ELSE
          new_s := dep.start_date;
      END CASE;

      final_s := new_s;

      -- Check ALL other predecessors of this successor to find the most restrictive start
      FOR other_pred IN
        SELECT td2.predecessor_id, td2.dependency_type AS dep_type,
               p.start_date, p.end_date, p.buffer_days, p.buffer_position
        FROM task_dependencies td2
        JOIN tasks p ON p.id = td2.predecessor_id
        WHERE td2.task_id = dep.succ_id
          AND td2.predecessor_id != current_id
      LOOP
        IF other_pred.buffer_position = 'end' THEN
          other_eff_end := add_working_days(other_pred.end_date, other_pred.buffer_days, _include_weekends);
          other_eff_start := other_pred.start_date;
        ELSE
          other_eff_end := other_pred.end_date;
          other_eff_start := add_working_days(other_pred.start_date, -other_pred.buffer_days, _include_weekends);
        END IF;

        CASE other_pred.dep_type
          WHEN 'FS' THEN
            candidate_s := next_working_day(other_eff_end + 1, _include_weekends);
          WHEN 'FF' THEN
            candidate_s := add_working_days(other_eff_end, -dep_duration, _include_weekends);
          WHEN 'SS' THEN
            candidate_s := next_working_day(other_eff_start, _include_weekends);
          WHEN 'SF' THEN
            candidate_s := add_working_days(next_working_day(other_eff_start - 1, _include_weekends), -dep_duration, _include_weekends);
          ELSE
            candidate_s := dep.start_date;
        END CASE;

        IF candidate_s > final_s THEN
          final_s := candidate_s;
        END IF;
      END LOOP;

      new_e := add_working_days(final_s, dep_duration, _include_weekends);

      UPDATE tasks SET start_date = final_s, end_date = new_e WHERE id = dep.succ_id;
      processed := processed + 1;
      queue := queue || dep.succ_id;
    END LOOP;
  END LOOP;

  RETURN processed;
END;
$function$;
