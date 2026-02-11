
-- Helper: advance to next working day (skip weekends)
CREATE OR REPLACE FUNCTION public.next_working_day(_d DATE, _include_weekends BOOLEAN)
RETURNS DATE
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF _include_weekends THEN RETURN _d; END IF;
  WHILE EXTRACT(DOW FROM _d) IN (0, 6) LOOP
    _d := _d + 1;
  END LOOP;
  RETURN _d;
END;
$$;

-- Helper: add working days (skip weekends when not included)
CREATE OR REPLACE FUNCTION public.add_working_days(_start DATE, _days INTEGER, _include_weekends BOOLEAN)
RETURNS DATE
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  result DATE := _start;
  remaining INTEGER := ABS(_days);
  dir INTEGER := CASE WHEN _days >= 0 THEN 1 ELSE -1 END;
BEGIN
  IF _include_weekends THEN RETURN _start + _days; END IF;
  WHILE remaining > 0 LOOP
    result := result + dir;
    IF EXTRACT(DOW FROM result) NOT IN (0, 6) THEN
      remaining := remaining - 1;
    END IF;
  END LOOP;
  RETURN result;
END;
$$;

-- Helper: count working days between two dates
CREATE OR REPLACE FUNCTION public.working_days_diff(_start DATE, _end DATE, _include_weekends BOOLEAN)
RETURNS INTEGER
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  cnt INTEGER := 0;
  d DATE := _start;
  dir INTEGER := CASE WHEN _end >= _start THEN 1 ELSE -1 END;
BEGIN
  IF _include_weekends THEN RETURN _end - _start; END IF;
  WHILE d <> _end LOOP
    d := d + dir;
    IF EXTRACT(DOW FROM d) NOT IN (0, 6) THEN
      cnt := cnt + dir;
    END IF;
  END LOOP;
  RETURN cnt;
END;
$$;

-- Main cascade function
CREATE OR REPLACE FUNCTION public.cascade_task_dates(
  _task_id UUID,
  _new_start DATE,
  _new_end DATE,
  _include_weekends BOOLEAN
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
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
BEGIN
  -- Update the root task
  UPDATE tasks SET start_date = _new_start, end_date = _new_end WHERE id = _task_id;

  WHILE array_length(queue, 1) > 0 LOOP
    current_id := queue[1];
    queue := queue[2:];

    IF current_id = ANY(visited) THEN CONTINUE; END IF;
    visited := visited || current_id;

    -- Get predecessor's current (already-updated) dates
    SELECT start_date, end_date, buffer_days, buffer_position
      INTO pred_start, pred_end, pred_buffer, pred_buffer_pos
      FROM tasks WHERE id = current_id;

    -- Compute effective dates with buffer
    IF pred_buffer_pos = 'end' THEN
      eff_end := add_working_days(pred_end, pred_buffer, _include_weekends);
      eff_start := pred_start;
    ELSE
      eff_end := pred_end;
      eff_start := add_working_days(pred_start, -pred_buffer, _include_weekends);
    END IF;

    FOR dep IN SELECT id, start_date, end_date, dependency_type FROM tasks WHERE depends_on = current_id LOOP
      dep_duration := working_days_diff(dep.start_date, dep.end_date, _include_weekends);

      CASE dep.dependency_type
        WHEN 'FS' THEN
          new_s := next_working_day(eff_end + 1, _include_weekends);
          new_e := add_working_days(new_s, dep_duration, _include_weekends);
        WHEN 'FF' THEN
          new_e := eff_end;
          new_s := add_working_days(eff_end, -dep_duration, _include_weekends);
        WHEN 'SS' THEN
          new_s := next_working_day(eff_start, _include_weekends);
          new_e := add_working_days(new_s, dep_duration, _include_weekends);
        WHEN 'SF' THEN
          new_e := next_working_day(eff_start - 1, _include_weekends);
          new_s := add_working_days(new_e, -dep_duration, _include_weekends);
        ELSE
          new_s := dep.start_date;
          new_e := dep.end_date;
      END CASE;

      UPDATE tasks SET start_date = new_s, end_date = new_e WHERE id = dep.id;
      processed := processed + 1;
      queue := queue || dep.id;
    END LOOP;
  END LOOP;

  RETURN processed;
END;
$$;
