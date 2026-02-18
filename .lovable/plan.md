

## Fix: Auto-Calculate Dates for Tasks Depending on Any Predecessor (Including Sub-Tasks)

### Problem
When "Construction of New Interior Walls" is set to depend on "Concrete Re-Pour/Repair" (a sub-task), the start and end dates remain at their defaults (Feb 18) instead of being auto-calculated based on the predecessor's end date (Apr 09).

### Root Cause
Two issues:

1. **Reconciliation skips leaf predecessors**: In `useProjectData.ts` line 387, the post-fetch reconciliation loop has the guard `if (!pred || pred.subTasks.length === 0) continue;`. This was added to only handle parent-task predecessors, but it **skips all leaf tasks** -- including sub-tasks. So after data loads, tasks depending on sub-tasks are never auto-corrected.

2. **Potential stale closure in updateTask**: When the user sets the dependency in the TaskDialog and saves, `updateTask` tries to find the predecessor in `project.buckets`. If the React state is stale (e.g., the task was just created and a refetch is still pending), the predecessor might not be found, causing the scheduling to silently skip.

### Solution

**File: `src/hooks/useProjectData.ts`**

1. **Broaden the reconciliation loop** (line 384-402): Remove the `pred.subTasks.length === 0` guard so that ALL tasks with dependencies are checked and auto-corrected on every data fetch. The `getEffectiveDates` function already handles both leaf tasks (returns stored dates) and parent tasks (returns rolled-up dates), so this works correctly for all cases.

2. **Add DB fallback in updateTask**: When the predecessor is not found in the in-memory task tree during `updateTask`, query the database directly to get the predecessor's dates. This prevents stale closures from silently skipping the scheduling.

### What Changes

- Line 387: Change from `if (!pred || pred.subTasks.length === 0) continue;` to `if (!pred) continue;`
- In the `updateTask` dependency scheduling block (~line 455): Add a fallback that queries the DB for the predecessor if it's not found in the in-memory tree, then schedules accordingly
- Both changes ensure that setting a dependency on any task (top-level, parent, or sub-task) will always auto-calculate the dependent task's dates

### What Stays the Same
- The `getEffectiveDates` utility (already handles both leaf and parent tasks)
- The `scheduleTask` function (unchanged)
- The cascade logic for sub-task date changes propagating to parent dependents
- All other scheduling, timeline, and critical path calculations
