
-- Create constraint type enum
CREATE TYPE schedule_constraint AS ENUM (
  'ASAP', 'SNET', 'SNLT', 'MSO', 'MFO', 'FNET', 'FNLT'
);

-- Add columns to tasks
ALTER TABLE tasks
  ADD COLUMN constraint_type schedule_constraint NOT NULL DEFAULT 'ASAP',
  ADD COLUMN constraint_date date;

-- Update cascade_task_dates to apply constraints
CREATE OR REPLACE FUNCTION public.cascade_task_dates(_task_id uuid, _new_start date, _new_end date, _include_weekends boolean)
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
  other_pred RECORD;
  other_eff_end DATE;
  other_eff_start DATE;
  candidate_s DATE;
  final_s DATE;
  -- Constraint variables
  v_ct schedule_constraint;
  v_cd DATE;
BEGIN
  UPDATE tasks SET start_date = _new_start, end_date = _new_end WHERE id = _task_id;

  WHILE array_length(queue, 1) > 0 LOOP
    current_id := queue[1];
    queue := queue[2:];

    IF current_id = ANY(visited) THEN CONTINUE; END IF;
    visited := visited || current_id;

    SELECT start_date, end_date, buffer_days, buffer_position
      INTO pred_start, pred_end, pred_buffer, pred_buffer_pos
      FROM tasks WHERE id = current_id;

    IF pred_buffer_pos = 'end' THEN
      eff_end := add_working_days(pred_end, pred_buffer, _include_weekends);
      eff_start := pred_start;
    ELSE
      eff_end := pred_end;
      eff_start := add_working_days(pred_start, -pred_buffer, _include_weekends);
    END IF;

    FOR dep IN
      SELECT td.task_id AS succ_id, td.dependency_type AS dep_type,
             t.start_date, t.end_date
      FROM task_dependencies td
      JOIN tasks t ON t.id = td.task_id
      WHERE td.predecessor_id = current_id
    LOOP
      dep_duration := working_days_diff(dep.start_date, dep.end_date, _include_weekends);

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

      -- Apply constraint logic for the successor
      SELECT constraint_type, constraint_date INTO v_ct, v_cd FROM tasks WHERE id = dep.succ_id;

      IF v_ct = 'SNET' AND v_cd IS NOT NULL AND v_cd > final_s THEN
        final_s := v_cd;
        new_e := add_working_days(final_s, dep_duration, _include_weekends);
      ELSIF v_ct = 'SNLT' AND v_cd IS NOT NULL AND v_cd < final_s THEN
        final_s := v_cd;
        new_e := add_working_days(final_s, dep_duration, _include_weekends);
      ELSIF v_ct = 'MSO' AND v_cd IS NOT NULL THEN
        final_s := v_cd;
        new_e := add_working_days(final_s, dep_duration, _include_weekends);
      ELSIF v_ct = 'MFO' AND v_cd IS NOT NULL THEN
        new_e := v_cd;
        final_s := add_working_days(v_cd, -dep_duration, _include_weekends);
      ELSIF v_ct = 'FNET' AND v_cd IS NOT NULL AND v_cd > new_e THEN
        new_e := v_cd;
      ELSIF v_ct = 'FNLT' AND v_cd IS NOT NULL AND v_cd < new_e THEN
        new_e := v_cd;
      END IF;

      UPDATE tasks SET start_date = final_s, end_date = new_e WHERE id = dep.succ_id;
      processed := processed + 1;
      queue := queue || dep.succ_id;
    END LOOP;
  END LOOP;

  RETURN processed;
END;
$function$;
