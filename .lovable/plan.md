
## Fix: Use Rolled-Up Dates When Scheduling Against Parent Task Dependencies

### Problem
When a task depends on a parent task (one with sub-tasks), the scheduling engine uses the parent's *stored* database dates instead of the *rolled-up* dates calculated from its sub-tasks. For example, "Signage Lightbox Removal" depends on "Demolition/Space Reset" (which ends Apr 04 based on sub-tasks), but the scheduling still uses the parent's original stored dates (Feb 18), resulting in incorrect start/end dates for the dependent task.

### Root Cause
In `useProjectData.ts`, line ~410, the predecessor is fetched from `allTasks` which returns tasks with their raw stored dates. For parent tasks, the actual effective dates should be the min(sub-task starts) and max(sub-task ends), accounting for buffers -- but this rollup is only done in the UI layer (`TaskRow.tsx`), not in the scheduling logic.

### Solution
Add a helper function that computes rolled-up effective dates for any task (returning stored dates for leaf tasks, rolled-up dates for parents). Use this when looking up the predecessor in the dependency scheduling logic.

### Technical Details

**File: `src/hooks/useProjectData.ts`**

1. Add a utility function `getEffectiveDates(task)` that:
   - If `task.subTasks.length === 0`, returns `{ startDate, endDate }` as-is
   - If sub-tasks exist, computes min start / max end from sub-tasks (same logic as `getRolledUp` in TaskRow.tsx), accounting for buffer days/position

2. Update the dependency scheduling block (~line 410-418) to use `getEffectiveDates(predecessor)` when constructing the predecessor object passed to `scheduleTask`, so the correct rolled-up dates are used

3. Similarly update the `cascade_task_dates` call path -- when a parent task's sub-task dates change, ensure the cascade uses the rolled-up dates

This ensures that any task depending on a parent task will be scheduled relative to the parent's actual (rolled-up) date range, not its stale stored dates.
