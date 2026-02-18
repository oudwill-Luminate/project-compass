

## Auto-Calculate Dates for Parent Tasks with Sub-Tasks

### Problem
When opening a parent task (one with sub-tasks) in the Edit Task dialog, the date fields show editable values even though the table view correctly rolls up dates from sub-tasks. This is confusing because any manual date changes get overridden by the rollup logic anyway.

### Solution
When a task has sub-tasks, replace the editable date pickers with a read-only display showing the auto-calculated dates, along with a clear label indicating they are derived from sub-tasks.

### Changes

**File: `src/components/TaskDialog.tsx`**

In the Dates and Duration section (around lines 233-289):

- Detect if `task.subTasks.length > 0` (parent task)
- If parent: show the rolled-up start/end dates as read-only styled text (not editable pickers), with a small note like "Auto-calculated from sub-tasks". Disable the Duration input as well.
- If not a parent: keep the current editable date pickers and duration input as-is

The rolled-up dates will be computed using the same `getRolledUp` logic already used in `TaskRow.tsx`. We will import or inline a lightweight version that computes the min start and max end from `task.subTasks`.

### Technical Detail

```text
IF task.subTasks.length > 0:
  +------------------------------------------------------+
  | Expected Start     Expected Finish    Duration (days) |
  | [icon] Feb 18      [icon] Feb 25      7               |
  | (i) Auto-calculated from 3 sub-tasks                  |
  +------------------------------------------------------+
ELSE:
  (current editable pickers, unchanged)
```

- Compute earliest start and latest end from `task.subTasks` (accounting for buffer days/position)
- Display as disabled/read-only buttons styled consistently with the existing date buttons
- Add a muted info line below: "Auto-calculated from N sub-tasks"
- Duration is also shown read-only as the difference between the two dates
