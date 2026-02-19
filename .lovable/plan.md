

## Fix: Duration Reverts on Save

### The Problem

Every time the TaskDialog saves, it passes the full form data (including `dependencies`) to `updateTask`. This causes `updateTask` to treat it as a "dependency changed" event and recompute dates from the predecessors -- overwriting the user's manually set duration.

Specifically in `src/hooks/useProjectData.ts`, at the `updateTask` function:

1. `cleanedFormData` includes `dependencies` (always, even if unchanged)
2. `dependencyChanged` check (`updates.dependencies !== undefined`) evaluates to **true**
3. The function computes `latestScheduled` from predecessors
4. Line 664: `updates = { ...updates, startDate: latestScheduled.startDate, endDate: latestScheduled.endDate }` **overwrites the user's new end date**
5. The overwritten dates get saved to the database, reverting the duration

### The Fix

Two changes are needed:

**1. TaskDialog (`src/components/TaskDialog.tsx`)**: Only include `dependencies` and `exclusionLinks` in the update payload if they actually changed from the original task values. This prevents every save from triggering the dependency rescheduling logic.

In `handleSave`, compare `cleanDeps` against `task.dependencies` and `cleanExclusions` against `task.exclusionLinks` before including them:

```text
// Only include dependencies if they actually changed
const depsChanged = JSON.stringify(cleanDeps) !== JSON.stringify(task.dependencies || []);
const exclusionsChanged = JSON.stringify(cleanExclusions.sort()) !== JSON.stringify((task.exclusionLinks || []).sort());

const cleanedFormData = {
  ...formData,
  ...(depsChanged ? { dependencies: cleanDeps, dependsOn: ..., dependencyType: ... } : {}),
  ...(exclusionsChanged ? { exclusionLinks: cleanExclusions } : {}),
};
```

**2. updateTask (`src/hooks/useProjectData.ts`)**: As a safety net, even when dependencies ARE included in the update, only override dates if the task's current start actually violates the computed dependency schedule. This mirrors the reconciliation fix:

```text
if (latestScheduled) {
  // Only override if current start violates the dependency
  const currentStart = updates.startDate || oldTask.startDate;
  if (currentStart < latestScheduled.startDate) {
    updates = { ...updates, startDate: latestScheduled.startDate, endDate: latestScheduled.endDate };
  }
}
```

### Files Changed

- `src/components/TaskDialog.tsx`: Compare dependencies/exclusions before including in update payload
- `src/hooks/useProjectData.ts`: Guard the date override in `updateTask` to only apply when the dependency is violated

### What Stays the Same

- Reconciliation loop (already fixed to be conditional)
- Cascade RPC logic (unchanged)
- All database schema and RLS policies (unchanged)
- Dependency detection on actual dependency changes (still works -- adding/removing a dependency will still reschedule)
