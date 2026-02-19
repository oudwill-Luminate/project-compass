

## Fix: Refresh Schedule Must Persist Corrected Dates

### Root Cause

The scheduling engine has two layers:
1. **In-memory reconciliation** (runs on every `fetchAll`): correctly computes ASAP pull-forward and exclusion shifts, but deliberately does NOT write to the database ("to avoid feedback loop")
2. **Cascade RPC** (runs on task save): reads dates from the database to propagate changes

The problem: these two layers are disconnected. The in-memory reconciliation correctly calculates that Ductwork Distribution should start May 5 (not May 13), but never persists that. So when the cascade RPC runs for downstream tasks, it reads the stale May 13 date from the database. This cascades through the chain:

```text
Ductwork Distribution: DB=May 13 (should be May 5)
  -> New Electrical Distribution: DB=May 20 (should be ~May 9)
    -> Dry-Wall: Phase 2: DB=May 29 (should be ~May 15)
```

The `refreshSchedule` button just calls `fetchAll()` again, which re-runs the in-memory fix but still never saves it.

### The Fix

**File: `src/hooks/useProjectData.ts`**

Create a dedicated `refreshSchedule` function that:
1. Runs the same reconciliation logic as `fetchAll`
2. Compares reconciled dates against the database dates
3. Persists any corrected dates to the database
4. Calls `cascade_task_dates` for each changed task so successors update
5. Re-fetches to reflect the final state

```text
const refreshSchedule = useCallback(async () => {
  if (!project || !projectId) return;

  const allTasks = project.buckets.flatMap(b => flattenTasks(b.tasks));
  const includeWeekends = project.includeWeekends;

  // --- Pass 1: Dependency reconciliation (same logic as fetchAll) ---
  for (const task of allTasks) {
    // Compute latestStart from all predecessors (existing logic)
    // If ASAP and task.startDate > latestStart, pull forward
    // Apply constraint overrides
    // Record original vs corrected dates
  }

  // --- Pass 2: Exclusion pass (same logic as fetchAll) ---
  // Shift overlapping exclusion-linked tasks

  // --- Pass 3: Persist changes ---
  // For each task where dates changed:
  //   1. UPDATE tasks SET start_date, end_date WHERE id = task.id
  //   2. Call cascade_task_dates to propagate to successors

  // --- Pass 4: Re-fetch ---
  await fetchAll();
}, [project, projectId, fetchAll]);
```

**File: `src/context/ProjectContext.tsx`**

Update to use the new dedicated `refreshSchedule` function instead of just `refetch`.

### Technical Details

The key difference from the current approach:
- Current: `refreshSchedule` = `fetchAll()` = in-memory only
- Fixed: `refreshSchedule` = reconcile + persist to DB + cascade + fetchAll

To avoid the feedback loop that the original design was concerned about:
- The realtime subscription triggers `fetchAll()` (in-memory only, as before)
- Only the explicit `refreshSchedule` action persists changes
- This is safe because `refreshSchedule` is user-initiated (button click), not triggered by realtime events

The persist step will batch updates and cascades in dependency order (topological sort) so that upstream tasks are persisted before downstream tasks cascade from them.

### What This Fixes

- Ductwork Distribution will be persisted at May 5 (pulled forward from May 13)
- New Electrical Distribution will cascade to ~May 9 (instead of May 20)
- Dry-Wall: Phase 2 will cascade to ~May 15 (instead of May 29)
- All successor chains will reflect the correct dates in both the UI and database

### Files Changed

- `src/hooks/useProjectData.ts`: Add dedicated `refreshSchedule` function that persists reconciled dates and cascades
- `src/context/ProjectContext.tsx`: Wire up the new `refreshSchedule` instead of `refetch`

### What Stays the Same

- The `fetchAll` in-memory reconciliation (unchanged, still runs on every data load)
- Cascade RPC logic (unchanged)
- TaskDialog, database schema, RLS policies (unchanged)
- Realtime subscription behavior (unchanged)
