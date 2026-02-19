

## Fix: Tasks Not Rescheduling When Dependencies Are Added

### Root Cause

When you add "Trim Install" as a dependency of "Painting - Interior", two things go wrong:

1. **The date adjustment only pushes tasks later, never earlier**: At line 677, the code checks `if (currentStart < latestScheduled.startDate)` -- meaning it only moves a task if it starts *before* the dependency allows. "Painting - Interior" starts *after* its predecessor's end, so the condition is false and the dates are left unchanged.

2. **The cascade RPC is never called**: Because the dates didn't change (bug #1), the `datesChanged` flag remains false, so the cascade engine at line 822-830 is skipped entirely. The task's database dates are never updated.

In summary: adding a dependency currently does nothing to pull an ASAP task forward to its correct earliest start.

### The Fix

**File: `src/hooks/useProjectData.ts`**

**Change 1 -- Pull ASAP tasks forward when dependency is added (around line 674-681)**

Update the dependency scheduling block to also pull ASAP tasks forward when they start later than their dependencies require:

```text
// BEFORE (line 676-679):
const currentStart = updates.startDate || oldTask.startDate;
if (currentStart < latestScheduled.startDate) {
  updates = { ...updates, startDate: latestScheduled.startDate, endDate: latestScheduled.endDate };
}

// AFTER:
const currentStart = updates.startDate || oldTask.startDate;
const taskConstraint = (updates.constraintType || oldTask.constraintType) as ScheduleConstraintType;
if (currentStart < latestScheduled.startDate) {
  // Task starts too early -- always shift forward
  updates = { ...updates, startDate: latestScheduled.startDate, endDate: latestScheduled.endDate };
} else if (taskConstraint === 'ASAP' && currentStart > latestScheduled.startDate) {
  // ASAP task starts later than needed -- pull it forward
  updates = { ...updates, startDate: latestScheduled.startDate, endDate: latestScheduled.endDate };
}
```

**Change 2 -- Trigger cascade when dependencies change (around line 868-872)**

When only dependencies change (but not dates directly), we still need to call the cascade RPC so that the new dates propagate to successor tasks:

```text
// BEFORE (line 870):
if (datesChanged || dependencyChanged) {
  fetchAll();
}

// AFTER:
if (dependencyChanged && !datesChanged) {
  // Dependencies changed but updateTask scheduling already set new dates above.
  // Call cascade to propagate to successors.
  const updatedStart = updates.startDate || oldTask.startDate;
  const updatedEnd = updates.endDate || oldTask.endDate;
  await supabase.rpc('cascade_task_dates', {
    _task_id: taskId,
    _new_start: updatedStart,
    _new_end: updatedEnd,
    _include_weekends: project.includeWeekends,
  });
}
if (datesChanged || dependencyChanged) {
  fetchAll();
}
```

### Why This Fixes the Problem

- When you add "Trim Install" as a dependency of "Painting - Interior":
  - The scheduling block computes the earliest start after Trim Install
  - Since Painting has ASAP constraint and starts later than needed, it gets pulled forward
  - The updated dates are written to the database
  - The cascade RPC is called so any tasks depending on Painting also get rescheduled
  - `fetchAll()` refreshes the UI with the corrected dates

### Files Changed

- `src/hooks/useProjectData.ts`: Fix dependency scheduling condition and ensure cascade runs on dependency changes

### What Stays the Same

- Cascade RPC (unchanged)
- In-memory reconciliation in fetchAll (already has ASAP pull-forward -- this fix ensures it also works at save time)
- TaskDialog (unchanged)
- Database schema and RLS policies (unchanged)
