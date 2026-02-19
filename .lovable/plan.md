

## Fix: Duration Reverting After Edit on Dependent Tasks

### Problem
When you change the duration of a task that depends on another task (like 'New Electrical Distribution'), the new duration is saved to the database but immediately overwritten. The reconciliation loop in `fetchAll()` recalculates dates for **every** dependent task on **every** data fetch, regardless of whether the predecessor actually changed. This silently reverts your manual edits.

### Root Cause
In `src/hooks/useProjectData.ts`, lines 385-403, the reconciliation loop runs inside `fetchAll()`:

```text
for (const task of allTasksFlat) {
  if (!task.dependsOn) continue;
  const pred = ...;
  const scheduled = scheduleTask(pred, task, ...);
  if (scheduled !== task dates) {
    // Overwrites the task's dates in DB
  }
}
```

This loop fires every time data is fetched -- after saves, after realtime events, on initial load. It doesn't know whether the mismatch is because:
- (A) The predecessor moved and the dependent needs updating, OR
- (B) The user intentionally changed this task's duration/dates

It always assumes (A) and overwrites.

### Solution
The reconciliation loop should only force-recalculate a dependent task's **start date** based on its predecessor, while **preserving the task's own duration**. This way:
- If a predecessor moves, the dependent shifts to maintain the correct start relative to the predecessor
- If a user changes the duration, the new duration is preserved because only the start date is locked to the predecessor

### Technical Changes

**File: `src/hooks/useProjectData.ts` (reconciliation loop, lines 385-403)**

Replace the current logic that overwrites both start and end dates with logic that:

1. Computes the correct **start date only** based on the predecessor (using the dependency type)
2. Preserves the task's **existing duration** (difference between its current start and end)
3. Only writes to the DB if the start date actually needs to move

```text
for (const task of allTasksFlat) {
  if (!task.dependsOn) continue;
  const pred = allTasksFlat.find(t => t.id === task.dependsOn);
  if (!pred) continue;
  const eff = getEffectiveDates(pred);
  const scheduled = scheduleTask(
    { ...pred, startDate: eff.startDate, endDate: eff.endDate },
    task,
    task.dependencyType,
    includeWeekends
  );
  // Only reconcile the START date; preserve the user's duration
  if (scheduled.startDate !== task.startDate) {
    const currentDuration = workingDaysDiff(
      parseISO(task.startDate), parseISO(task.endDate), includeWeekends
    );
    const newEnd = format(
      addWorkingDays(parseISO(scheduled.startDate), currentDuration, includeWeekends),
      'yyyy-MM-dd'
    );
    supabase.from('tasks').update({
      start_date: scheduled.startDate,
      end_date: newEnd,
    }).eq('id', task.id).then(() => {});
  }
}
```

This ensures:
- Predecessor changes still cascade correctly (dependent's start shifts)
- User edits to duration are never silently overwritten
- The "Refresh Schedule" button still works as a manual fallback since it calls `fetchAll()`

### What Changes
- **1 file**: `src/hooks/useProjectData.ts` -- reconciliation loop only (approx. lines 385-403)

### What Stays the Same
- The `scheduleTask` function (unchanged)
- The `cascade_task_dates` RPC call in `updateTask` (unchanged -- this handles explicit cascades when dates/buffer change)
- Realtime subscriptions (unchanged)
- Task Dialog save logic (unchanged)
- "Refresh Schedule" button (unchanged)
