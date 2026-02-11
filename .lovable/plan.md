

## Implement Professional Dependency Auto-Scheduling

### Problem
Currently, when you set a Finish-to-Start (FS) dependency (e.g., "Water Lines depends on Drainage"), the system only shifts dependent tasks when dates are manually changed. It does **not** auto-schedule the dependent task's dates when the dependency link is first created or when the dependency type changes.

### Solution
Add a proper dependency scheduling engine that:
1. Automatically repositions a task's dates when a dependency is assigned or changed
2. Handles all four standard dependency types (FS, FF, SS, SF)
3. Cascades date changes through the entire dependency chain
4. Detects circular dependencies to prevent infinite loops

### Dependency Type Scheduling Rules

```text
FS (Finish-to-Start): Dependent starts after predecessor finishes
   Predecessor:  |======|
   Dependent:              |======|
   Rule: dependent.start = predecessor.end + 1 day

FF (Finish-to-Finish): Both finish at the same time
   Predecessor:  |======|
   Dependent:       |======|
   Rule: dependent.end = predecessor.end, start adjusted to keep duration

SS (Start-to-Start): Both start at the same time
   Predecessor:  |======|
   Dependent:    |======|
   Rule: dependent.start = predecessor.start, end adjusted to keep duration

SF (Start-to-Finish): Dependent finishes when predecessor starts
   Predecessor:        |======|
   Dependent:  |======|
   Rule: dependent.end = predecessor.start - 1 day, start adjusted to keep duration
```

### Technical Changes

**`src/hooks/useProjectData.ts` -- `updateTask` function:**

- Extract a reusable `scheduleDependentTask(predecessorTask, dependentTask, dependencyType)` function that calculates and returns the new start/end dates for the dependent task
- When `dependsOn` or `dependencyType` changes on a task:
  1. Look up the predecessor task
  2. Calculate new dates using the dependency type rules
  3. Update the task's dates in the database
  4. Cascade: find all tasks that depend on this task and recursively reschedule them
- When a predecessor's dates change (existing logic), use the same scheduling function to propagate to all dependents with correct dependency-type math (replacing the current simple "shift by delta" approach)
- Add circular dependency detection (track visited task IDs) to prevent infinite loops

**`src/components/TaskDialog.tsx` -- dependency change handling:**

- When the user changes `dependsOn` or `dependencyType` in the dialog, ensure the saved updates include both the dependency fields AND the recalculated dates, so the `updateTask` function processes them together

**`src/hooks/useProjectData.ts` -- new helper function:**

```
scheduleTask(predecessor, dependent, depType) -> { startDate, endDate }
```

This function computes the correct dates for each dependency type while preserving the dependent task's duration.

### Edge Cases Handled
- Circular dependency prevention (visited set)
- Removing a dependency (setting to "none") -- no date changes needed
- Changing dependency type on an existing link -- reschedules immediately
- Chain cascading: A -> B -> C, changing A's dates propagates through B then C

