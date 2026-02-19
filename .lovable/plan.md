

## Fix: Stop Reconciliation Feedback Loop From Reverting Duration

### The Problem

The reconciliation and exclusion passes inside `fetchAll()` are writing date changes directly to the database. Every DB write triggers a realtime event, which triggers another `fetchAll()`, which runs the passes again, creating a feedback loop that overwrites your manual duration changes.

The sequence:
1. You save the new duration (e.g., 5 days) -- correctly written to the database
2. Realtime event fires, triggering `fetchAll()`
3. `fetchAll()` runs the exclusion pass, detects overlaps with exclusion-linked tasks
4. The exclusion pass writes "corrected" dates to the database (fire-and-forget)
5. Those writes trigger more realtime events, more `fetchAll()` calls
6. Meanwhile, `updateTask` also calls `fetchAll()` explicitly
7. Multiple `fetchAll()` calls race each other, each overwriting dates in the database
8. The task's duration ends up reverting to whatever the exclusion/reconciliation math computes

### The Fix

Remove all database writes from the `fetchAll()` reconciliation and exclusion passes. These passes should only adjust in-memory state (for correct display), not write back to the database. The authoritative scheduling enforcement is already handled by the `cascade_task_dates` RPC, which runs when dates actually change via `updateTask`.

### Technical Details

**File: `src/hooks/useProjectData.ts`**

**Change 1: Reconciliation pass (lines 511-517)** -- Remove the `supabase.from('tasks').update(...)` call. Only update the in-memory task object so the UI displays correctly:

```text
// BEFORE:
if (finalStart !== task.startDate || finalEnd !== task.endDate) {
  supabase.from('tasks').update({
    start_date: finalStart,
    end_date: finalEnd,
  }).eq('id', task.id).then(() => {});
}

// AFTER:
if (finalStart !== task.startDate || finalEnd !== task.endDate) {
  task.startDate = finalStart;
  task.endDate = finalEnd;
}
```

**Change 2: Exclusion pass (lines 538-543)** -- Same treatment. Remove the DB write and only update the in-memory task objects:

```text
// BEFORE:
laterTask.startDate = format(newStart, 'yyyy-MM-dd');
laterTask.endDate = format(newEnd, 'yyyy-MM-dd');
supabase.from('tasks').update({
  start_date: laterTask.startDate,
  end_date: laterTask.endDate,
}).eq('id', laterTask.id).then(() => {});

// AFTER:
laterTask.startDate = format(newStart, 'yyyy-MM-dd');
laterTask.endDate = format(newEnd, 'yyyy-MM-dd');
// No DB write -- only in-memory for display.
// Authoritative scheduling handled by cascade_task_dates RPC.
```

**Change 3: Move `setProject()` after reconciliation** -- Currently `setProject(proj)` is called at line 438 *before* the reconciliation loop modifies task dates. The reconciled dates are never reflected in React state. Move `setProject()` to after the exclusion pass so the UI displays the reconciled dates:

```text
// Remove setProject(proj) from line 438
// Add it after the exclusion pass (after line 546):
setProject({
  ...proj,
  buckets: proj.buckets.map(b => ({
    ...b,
    tasks: buildTaskTree(/* use the reconciled allTasksFlat */),
  })),
});
```

Since `allTasksFlat` is a flat array and we need tree structure, the simpler approach is to mutate the task objects in-place (they're fresh objects from `buildTaskTree`) during reconciliation, then call `setProject(proj)` afterward. The task objects in `proj.buckets[].tasks` are the same references as in `allTasksFlat`, so mutations are reflected.

### Files Changed

- `src/hooks/useProjectData.ts`: Remove DB writes from reconciliation and exclusion passes; move `setProject()` after reconciliation

### What Stays the Same

- `cascade_task_dates` RPC (unchanged -- still the authoritative scheduling engine)
- `updateTask` logic (unchanged -- still calls cascade RPC when dates change)
- TaskDialog fix (unchanged -- still only includes deps/exclusions when changed)
- All database schema and RLS policies (unchanged)
- Realtime subscriptions (unchanged -- they still trigger fetchAll for data freshness)
- "Refresh Schedule" button (unchanged)

