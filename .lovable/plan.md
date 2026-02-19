

## Fix: Cascade RPC Overwriting Task Dates With Buffer-Extended Values

### Root Cause

When you save a task with buffer days (like "Ductwork Distribution" which has a 2-day end buffer), the system:

1. Correctly saves your new duration to the database
2. Then calls the scheduling cascade function to update dependent tasks
3. But it passes buffer-extended dates to that function (your end date + 2 buffer days)
4. The cascade function's first action is to overwrite the task's own dates with what it received -- so it replaces your intended end date with one that's 2 days longer
5. This triggers a data refresh, and you see the old (longer) duration

The scheduling cascade function already handles buffer internally when calculating dependent tasks. By pre-computing the buffer and passing it in, the buffer gets applied twice and the task's own dates get corrupted.

### The Fix

Pass the task's actual dates (not buffer-extended dates) to the cascade function. The cascade function already reads buffer settings from the database and accounts for them when scheduling dependent tasks.

### Technical Details

**File: `src/hooks/useProjectData.ts` (~lines 807-822)**

Current code computes effective (buffer-extended) dates and passes them to the cascade:

```text
// BEFORE (bug: passes buffer-extended dates, RPC overwrites task with them):
const effectiveEnd = updatedTask.bufferDays > 0 && updatedTask.bufferPosition === 'end'
  ? format(addWorkingDays(...), 'yyyy-MM-dd')
  : updatedTask.endDate;
const effectiveStart = updatedTask.bufferDays > 0 && updatedTask.bufferPosition === 'start'
  ? format(addWorkingDays(...), 'yyyy-MM-dd')
  : updatedTask.startDate;

await supabase.rpc('cascade_task_dates', {
  _task_id: taskId,
  _new_start: effectiveStart,
  _new_end: effectiveEnd,
  ...
});
```

Fix: pass the actual task dates instead:

```text
// AFTER (fixed: pass actual dates, RPC handles buffer internally):
await supabase.rpc('cascade_task_dates', {
  _task_id: taskId,
  _new_start: updatedTask.startDate,
  _new_end: updatedTask.endDate,
  _include_weekends: project.includeWeekends,
});
```

The same fix applies to the parent-task cascade call (~lines 835-840), which should also pass the parent's actual rolled-up dates without pre-applying buffer.

### Why This Fixes It

- The cascade function already reads `buffer_days` and `buffer_position` from the database for each task it processes
- It computes effective dates internally when determining successor schedules
- By passing actual dates instead of effective dates, the function's initial `UPDATE tasks SET start_date, end_date` writes the correct (user-intended) values
- Buffer is only applied once (inside the cascade function) rather than twice

### Files Changed

- `src/hooks/useProjectData.ts`: Remove the effective-date computation before the cascade call; pass actual task dates directly

### What Stays the Same

- The cascade RPC itself (unchanged -- it already handles buffer correctly)
- Reconciliation loop (unchanged -- already in-memory only)
- TaskDialog (unchanged -- already only sends deps when changed)
- All database schema and RLS policies (unchanged)

