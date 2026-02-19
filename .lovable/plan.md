

## Fix: Exclusion Links Not Cascading Properly in Schedule Engine

### The Problem

The scheduling cascade function (`cascade_task_dates`) has two bugs related to exclusion links:

1. **Buffer not considered in exclusion checks**: When the cascade checks for overlaps between exclusion-linked tasks, it uses the other task's raw `end_date` -- ignoring its buffer days. For example, Fire Suppression ends May 4 but has a 1-day end buffer (effective end = May 5). Ductwork should start May 6, but the exclusion check only looks at May 4.

2. **Exclusion-linked tasks aren't re-queued**: The cascade only processes tasks via dependency chains. If you change Fire Suppression's dates, Ductwork Distribution won't be re-evaluated because Ductwork depends on Dry-Wall:Phase 1 (not Fire Suppression). They're only linked via an exclusion link. The RPC doesn't add exclusion-linked tasks to its processing queue.

3. **Processing order is non-deterministic**: When multiple successors of the same predecessor all have exclusion links with each other (Plumbing-Distribution, Fire Suppression, Ductwork Distribution are all successors of Dry-Wall:Phase 1), SQL doesn't guarantee processing order. If Ductwork is processed before Fire Suppression, it reads Fire Suppression's stale dates and can't properly chain after it.

### Current Data

The scheduling chain looks like this:

```text
Dry-Wall:Phase 1 (Apr 13-24, +2 buffer)
  ├── [FS dep] Plumbing-Distribution (Apr 29-30, +1 buffer)
  ├── [FS dep] Fire Suppression (May 1-4, +1 buffer)
  └── [FS dep] Ductwork Distribution (May 13-15, +2 buffer) <-- STUCK, should be ~May 6

Exclusion links:
  Plumbing-Distribution <-> Ductwork Distribution
  Plumbing-Distribution <-> Fire Suppression
  Fire Suppression <-> Ductwork Distribution
  Fire Suppression <-> New Electrical Distribution
  Ductwork Distribution <-> New Electrical Distribution
```

Ductwork should start right after Fire Suppression's effective end (May 4 + 1 buffer = May 5, so start May 6), but it's stuck at May 13.

### The Fix

**File: Database migration (new) -- update `cascade_task_dates` RPC**

Three improvements to the exclusion handling:

1. **Sort successors by start date** so earlier tasks are processed first, establishing their dates before later exclusion-linked tasks check against them:
   ```text
   ORDER BY t.start_date ASC
   ```

2. **Account for buffer in exclusion checks** -- read the other task's `buffer_days` and `buffer_position`, compute its effective end, and use that for overlap detection and shift calculation:
   ```text
   SELECT start_date, end_date, buffer_days, buffer_position
     INTO other_start, other_end, other_buf, other_buf_pos
     FROM tasks WHERE id = excl.other_id;

   IF other_buf_pos = 'end' THEN
     other_eff := add_working_days(other_end, other_buf, _include_weekends);
   ELSE
     other_eff := other_end;
   END IF;

   IF final_s <= other_eff AND new_e >= other_start THEN
     final_s := next_working_day(other_eff + 1, _include_weekends);
     new_e := add_working_days(final_s, dep_duration, _include_weekends);
   END IF;
   ```

3. **Add exclusion-linked tasks to the cascade queue** so that when a task is updated and overlaps with an exclusion-linked task, that linked task gets re-evaluated in a subsequent iteration:
   ```text
   -- After updating successor at line 146:
   FOR excl IN
     SELECT ... FROM task_exclusions WHERE task_a_id = dep.succ_id OR task_b_id = dep.succ_id
   LOOP
     IF NOT (excl.other_id = ANY(visited)) THEN
       queue := queue || excl.other_id;
     END IF;
   END LOOP;
   ```

**File: `src/hooks/useProjectData.ts`**

After calling `cascade_task_dates` in `updateTask`, also trigger cascades for tasks that are exclusion-linked to the updated task. This handles the case where the user changes Fire Suppression directly -- Ductwork needs to be re-evaluated even though it doesn't depend on Fire Suppression:

```text
// After the main cascade call (~line 815):
if (oldTask.exclusionLinks?.length > 0) {
  for (const linkedId of oldTask.exclusionLinks) {
    await supabase.rpc('cascade_task_dates', {
      _task_id: linkedId,
      _new_start: (await supabase.from('tasks').select('start_date').eq('id', linkedId).single()).data?.start_date,
      _new_end: (await supabase.from('tasks').select('end_date').eq('id', linkedId).single()).data?.end_date,
      _include_weekends: project.includeWeekends,
    });
  }
}
```

### Result

- When any task's dates change, exclusion-linked tasks are automatically re-evaluated
- Buffer days are properly considered when determining exclusion overlap and shift
- Sibling successors with exclusion links are processed in chronological order, ensuring correct chaining
- Ductwork Distribution will move up to start immediately after Fire Suppression's effective end

### Files Changed

- Database migration: Replace `cascade_task_dates` function with buffer-aware exclusion checks, ordered successor processing, and exclusion queue propagation
- `src/hooks/useProjectData.ts`: After cascade call in `updateTask`, also cascade exclusion-linked tasks

### What Stays the Same

- Task duration is always preserved (only start/end dates shift)
- Dependency logic (FS, FF, SS, SF) unchanged
- Constraint logic (SNET, MSO, etc.) unchanged
- In-memory reconciliation/exclusion pass in `fetchAll` unchanged
- TaskDialog, database schema, and RLS policies unchanged

