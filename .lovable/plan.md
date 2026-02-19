

## Fix: Tasks Not Automatically Pulled Forward (ASAP Scheduling)

### The Problem

The in-memory reconciliation loop (which runs after every data fetch) only pushes tasks **later** when they violate a dependency. It never pulls tasks **earlier** when slack exists. Specifically, the condition at line 470:

```text
if (latestStart && task.startDate < latestStart)
```

This says: "only move a task if it starts too early." For Ductwork Distribution (ASAP constraint, starting May 13 when it could start May 5), the reconciliation sees May 13 is *after* the earliest allowed start, so it does nothing.

For tasks with `constraintType = 'ASAP'`, the correct behavior is: start as soon as all predecessors allow -- meaning the task should be **pulled forward** to `latestStart` whenever `task.startDate > latestStart`.

Additionally, the exclusion pass (line 532) doesn't account for buffers on the earlier task, so it may place a task too early after an exclusion-linked task with an end buffer.

### The Fix

**File: `src/hooks/useProjectData.ts`**

1. **Pull ASAP tasks forward** (lines 467-476): Change the reconciliation condition so that ASAP tasks are moved to their earliest possible start, not just prevented from starting too early:

```text
// BEFORE: only shifts tasks that start too early
if (latestStart && task.startDate < latestStart) { ... }

// AFTER: for ASAP tasks, also pull forward if starting later than needed
if (latestStart) {
  const shouldShift =
    task.startDate < latestStart ||  // too early (existing logic)
    (task.constraintType === 'ASAP' && task.startDate > latestStart);  // too late
  if (shouldShift) {
    finalStart = latestStart;
    finalEnd = format(
      addWorkingDays(parseISO(finalStart), currentDuration, includeWeekends),
      'yyyy-MM-dd'
    );
  }
}
```

This ensures ASAP-constrained tasks always snap to their earliest possible start based on predecessors.

2. **Buffer-aware exclusion pass** (line 532): When computing the new start for the later task, use the earlier task's effective end (including buffer) instead of raw end date:

```text
// BEFORE:
const newStart = nextWorkingDay(addDays(parseISO(earlierTask.endDate), 1), includeWeekends);

// AFTER: account for buffer on the earlier task
const earlierEffEnd = earlierTask.bufferDays > 0 && earlierTask.bufferPosition === 'end'
  ? addWorkingDays(parseISO(earlierTask.endDate), earlierTask.bufferDays, includeWeekends)
  : parseISO(earlierTask.endDate);
const newStart = nextWorkingDay(addDays(earlierEffEnd, 1), includeWeekends);
```

3. **Buffer-aware overlap check** (line 527): Also factor buffer into the overlap detection:

```text
// BEFORE:
if (task.startDate <= linked.endDate && task.endDate >= linked.startDate)

// AFTER: use effective end dates for overlap check
const taskEffEnd = task.bufferDays > 0 && task.bufferPosition === 'end'
  ? format(addWorkingDays(parseISO(task.endDate), task.bufferDays, includeWeekends), 'yyyy-MM-dd')
  : task.endDate;
const linkedEffEnd = linked.bufferDays > 0 && linked.bufferPosition === 'end'
  ? format(addWorkingDays(parseISO(linked.endDate), linked.bufferDays, includeWeekends), 'yyyy-MM-dd')
  : linked.endDate;
if (task.startDate <= linkedEffEnd && taskEffEnd >= linked.startDate)
```

### Why This Works

- The cascade RPC handles authoritative date changes in the database (dependency chains, exclusions, constraints)
- The in-memory reconciliation is a "safety net" that corrects dates on fetch -- currently it only enforces "don't start too early" but not "start as soon as possible"
- By adding the forward-pull for ASAP tasks, Ductwork Distribution will snap to May 5 (right after Fire Suppression's effective end) on every data refresh
- Buffer-aware exclusion checks prevent tasks from overlapping with buffer zones

### Files Changed

- `src/hooks/useProjectData.ts`: Update reconciliation condition and exclusion pass

### What Stays the Same

- Cascade RPC (already updated with buffer-aware exclusions)
- TaskDialog (unchanged)
- Database schema and RLS policies (unchanged)
- Non-ASAP constraint handling (SNET, MSO, etc. unchanged)
