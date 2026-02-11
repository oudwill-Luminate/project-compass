

## Atomic Date Cascade via Database Function

### Problem
The current `cascadeDependents` function in `useProjectData.ts` (lines 464-489) performs recursive `supabase.from('tasks').update()` calls one at a time. If any call fails mid-cascade, the database ends up in an inconsistent state with some tasks rescheduled and others not.

### Solution
Move the entire cascade into a single PostgreSQL function called via RPC, ensuring atomicity.

---

### 1. Database Migration -- Create `cascade_task_dates` function

A new PostgreSQL function `cascade_task_dates(_task_id UUID, _new_start DATE, _new_end DATE, _include_weekends BOOLEAN)` that:

1. Updates the target task's `start_date` and `end_date`
2. Recursively finds all tasks where `depends_on` points to the updated task
3. For each dependent, computes new dates based on `dependency_type` (FS, FF, SS, SF), preserving task duration and respecting buffer days/position
4. Continues recursing through the full dependency chain
5. Returns a count of tasks updated
6. All within a single transaction (implicit in a PL/pgSQL function)

Key implementation details:
- Uses a loop with a queue (array of task IDs to process) rather than recursive CTEs, to handle cascading of already-computed new dates
- Includes weekend-skipping logic mirroring the frontend's `addWorkingDays` and `nextWorkingDay` helpers
- Uses a visited set (array) to prevent infinite loops from circular dependencies
- The function will be `SECURITY INVOKER` so RLS policies still apply

---

### 2. Frontend Changes -- `useProjectData.ts`

Replace the `cascadeDependents` async loop (lines 460-494) with a single RPC call:

```typescript
if (datesChanged) {
  await supabase.rpc('cascade_task_dates', {
    _task_id: taskId,
    _new_start: updatedTask.startDate,
    _new_end: updatedTask.endDate,
    _include_weekends: project.includeWeekends,
  });
}
```

This replaces approximately 30 lines of recursive async code with a single atomic call. The optimistic UI update and `fetchAll()` refetch remain unchanged.

---

### 3. Files to Change

| File | Action |
|------|--------|
| `supabase/migrations/...cascade_task_dates.sql` | New migration with the PL/pgSQL function |
| `src/hooks/useProjectData.ts` | Replace lines 460-494 with single `supabase.rpc()` call |

---

### 4. Technical Detail -- PL/pgSQL Function Pseudocode

```text
CREATE FUNCTION cascade_task_dates(_task_id, _new_start, _new_end, _include_weekends)
RETURNS INTEGER AS $$
DECLARE
  queue UUID[] := ARRAY[_task_id];
  visited UUID[] := ARRAY[]::UUID[];
  processed INT := 0;
  current_id UUID;
  dep RECORD;
  pred_start DATE; pred_end DATE;
  pred_buffer INT; pred_buffer_pos TEXT;
  dep_duration INT;
  new_start DATE; new_end DATE;
BEGIN
  -- Update the root task first
  UPDATE tasks SET start_date = _new_start, end_date = _new_end WHERE id = _task_id;

  WHILE array_length(queue, 1) > 0 LOOP
    current_id := queue[1];
    queue := queue[2:];

    IF current_id = ANY(visited) THEN CONTINUE; END IF;
    visited := visited || current_id;

    -- Get predecessor's current dates (already updated in this tx)
    SELECT start_date, end_date, buffer_days, buffer_position
      INTO pred_start, pred_end, pred_buffer, pred_buffer_pos
      FROM tasks WHERE id = current_id;

    FOR dep IN SELECT * FROM tasks WHERE depends_on = current_id LOOP
      -- Compute duration (working days or calendar days)
      dep_duration := count_working_days(dep.start_date, dep.end_date, _include_weekends);

      -- Schedule based on dependency_type (FS/FF/SS/SF)
      -- ... (mirrors frontend scheduleTask logic)

      UPDATE tasks SET start_date = new_start, end_date = new_end WHERE id = dep.id;
      processed := processed + 1;
      queue := queue || dep.id;
    END LOOP;
  END LOOP;

  RETURN processed;
END;
$$ LANGUAGE plpgsql;
```

The function includes helper sub-functions for `next_working_day` and `add_working_days` to handle weekend skipping, matching the existing frontend logic exactly.

