

## Fix: Budget Amounts Not Displaying on Task Rows

### Problem

The estimated cost column shows **$0** for all tasks, but the subtotal shows **$10,000**. This happens because:

- The "Plumbing" parent task has $10,000 stored in the database
- Its subtasks (Water Lines, Drainage) both have $0
- The `getRolledUp()` function in `TaskRow.tsx` replaces the parent's cost with the **sum of subtask costs** (0 + 0 = 0)
- The subtotal uses a different function (`flattenTasks`) that includes the parent's own $10,000, creating a mismatch

### Solution

Update `getRolledUp()` in `src/components/TaskRow.tsx` so that when subtask costs sum to zero, it falls back to the parent task's own stored cost. This way a budget set on a parent task is still visible until costs are distributed to subtasks.

### Changes

**File: `src/components/TaskRow.tsx`**

In the `getRolledUp` function (lines 31-34), change the cost calculation:

```typescript
// Before:
const estimatedCost = subs.reduce((s, t) => s + t.estimatedCost, 0);
const actualCost = subs.reduce((s, t) => s + t.actualCost, 0);

// After:
const subEstimated = subs.reduce((s, t) => s + t.estimatedCost, 0);
const subActual = subs.reduce((s, t) => s + t.actualCost, 0);
const estimatedCost = subEstimated > 0 ? subEstimated : task.estimatedCost;
const actualCost = subActual > 0 ? subActual : task.actualCost;
```

This is a small, targeted fix -- only 2 lines change in one file.
