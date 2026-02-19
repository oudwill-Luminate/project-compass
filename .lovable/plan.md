

## Instant Schedule Refresh on Buffer/Date Changes + Manual Refresh Button

### Problem
When you change the contingency (buffer days) on a task like "Construction of New Interior Walls," its dependent task "Dry-Wall: Phase 1" does not automatically update its start date. This is because the cascade logic only triggers when `startDate` or `endDate` explicitly change -- it ignores changes to `bufferDays` or `bufferPosition`, even though those affect the effective dates used by dependents.

Additionally, there is no manual fallback to force a schedule refresh.

### Root Cause
In `useProjectData.ts` (line 588-590), the `datesChanged` check only looks at `startDate` and `endDate`:
```text
const datesChanged =
  (updates.startDate && updates.startDate !== oldTask.startDate) ||
  (updates.endDate && updates.endDate !== oldTask.endDate);
```
When `bufferDays` changes from 5 to 0, the task's own dates don't change, so the cascade never fires and dependents keep their old dates.

### Solution

**1. Trigger cascade on buffer changes** (`src/hooks/useProjectData.ts`)
- Expand the `datesChanged` condition to also detect `bufferDays` or `bufferPosition` changes
- When buffer changes, re-run the local `scheduleTask` for all direct dependents of this task and update them, then cascade from there
- This ensures dependents instantly recalculate when contingency is added or removed

**2. Expose `refreshSchedule` through the context** (`src/context/ProjectContext.tsx`)
- Pass through the existing `refetch` (which is `fetchAll`) as `refreshSchedule` in the context value
- This runs the full reconciliation loop that checks every dependent task and corrects any stale dates

**3. Add a "Refresh Schedule" button** (`src/components/TableView.tsx`)
- Add a small button (with a refresh icon) in the table toolbar area
- Clicking it calls `refreshSchedule()` and shows a brief toast confirming the refresh
- This gives users a manual fallback if automatic cascading misses an edge case

### Technical Details

**File: `src/hooks/useProjectData.ts`**
- Line ~588: Change `datesChanged` to also include buffer changes:
  ```text
  const bufferChanged =
    (updates.bufferDays !== undefined && updates.bufferDays !== oldTask.bufferDays) ||
    (updates.bufferPosition !== undefined && updates.bufferPosition !== oldTask.bufferPosition);
  const datesChanged = ... || bufferChanged;
  ```
- When `bufferChanged` is true but actual dates didn't change, compute the effective dates for the updated task and cascade from there using the RPC

**File: `src/context/ProjectContext.tsx`**
- Add `refreshSchedule: () => Promise<void>` to the context type
- Wire it to `fetchAll` from the hook (already returned as `refetch`)

**File: `src/components/TableView.tsx`**
- Import `RefreshCw` from lucide-react
- Add a "Refresh Schedule" button next to existing toolbar actions
- On click: call `refreshSchedule()`, show toast "Schedule refreshed"

### What Stays the Same
- The `scheduleTask` function (unchanged)
- The `getEffectiveDates` utility (unchanged)
- The reconciliation loop in `fetchAll` (unchanged -- it already corrects stale dates on every fetch)
- Realtime subscription triggers (unchanged)
- All other task CRUD operations

