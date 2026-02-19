

## Fix: Task Duration Being Automatically Reverted

### The Problem

When you manually change a task's duration (e.g., setting "Ductwork Distribution" from 7 to 4 days), the system immediately reverts it back. Here's what's happening:

1. You save the new duration -- the end date is updated in the database
2. The database change triggers a real-time refresh of all project data
3. During that refresh, a "reconciliation loop" automatically recalculates every task's dates based on its dependencies and constraints
4. That recalculation overwrites the duration you just set, snapping it back to whatever the dependency math says it should be

This is essentially the scheduling engine fighting against your manual edits -- it treats every refresh as an opportunity to enforce dependency-driven dates, even when you deliberately changed the duration.

### The Fix

The reconciliation loop should only shift a task's dates when they genuinely violate a dependency or constraint. Right now it recalculates dates even when the current dates already satisfy all rules.

**What changes:**

Instead of always computing and applying new dates, the reconciliation will first check: "Does this task's current start date already satisfy its dependencies and constraints?" If yes, it leaves the task alone. It only shifts dates when the task would otherwise start *before* its earliest allowed date (violating a dependency or constraint).

### Technical Details

**File: `src/hooks/useProjectData.ts` (reconciliation loop, ~lines 443-513)**

Current behavior: For every task with dependencies, it computes a new `latestStart` and unconditionally applies it (along with recalculated end date), overwriting any manual changes.

New behavior:
- Compute the earliest allowed start from dependencies (the `latestStart`)
- Only override the task's dates if its current start date is **earlier** than the allowed start (i.e., it violates a dependency)
- If the task's current start is already at or after the allowed start, leave it alone -- the user's manual duration is respected
- Same logic for constraints: only override if the current dates actually violate the constraint

The key change in pseudocode:

```text
// BEFORE (always overrides):
finalStart = latestStart || task.startDate;
finalEnd = recalculate(finalStart, duration);
// writes to DB regardless

// AFTER (only overrides on violation):
const earliestAllowed = latestStart;
if (earliestAllowed && task.startDate < earliestAllowed) {
  // Task violates dependency -- shift it forward
  finalStart = earliestAllowed;
  finalEnd = recalculate(finalStart, duration);
} else {
  // Task is fine where it is -- respect manual dates
  finalStart = task.startDate;
  finalEnd = task.endDate;
}
// Only write if dates actually changed
```

The same principle applies to the constraint logic (SNET, MSO, etc.) and the exclusion pass -- only shift when there's an actual violation, not on every refresh.

### Files Changed

- `src/hooks/useProjectData.ts`: Update the reconciliation loop (~lines 443-542) to only shift dates when a dependency, constraint, or exclusion is actually violated

### What Stays the Same

- Dependency logic (unchanged -- still enforced, just not over-eagerly)
- Constraint types and their behavior (unchanged)
- Exclusion links (unchanged)
- The cascade RPC (unchanged -- server-side cascading is only triggered on explicit dependency changes)
- All UI components (unchanged)
- All database schema and RLS policies (unchanged)

