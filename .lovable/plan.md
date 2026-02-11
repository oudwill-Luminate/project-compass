

## Fix Progress Display on Timeline View Bars

The timeline bar gradient code exists but isn't producing a visible effect. Two issues need to be fixed:

### Issue 1: Insufficient Visual Contrast
The current gradient uses `${statusColor}66` (just 40% opacity hex suffix) for the unfilled portion, which looks almost identical to the filled portion on most status colors. The unfilled section needs to be much more transparent to create a clear visual distinction.

**Fix in `src/components/TimelineView.tsx`** (around line 97):
- Change `${statusColor}66` to `${statusColor}33` (20% opacity) for a much more visible contrast between the filled and unfilled portions of the bar.

### Issue 2: Parent Tasks with "Working" Status
Parent tasks (those with sub-tasks) have `isWorking` forced to `false` because of the `&& !hasSubTasks` check. If a parent task itself is marked as "working" with progress, the gradient won't show. For parent tasks, the progress should be calculated as the average of children's progress.

**Fix in `src/components/TimelineView.tsx`**:
- For parent tasks with "working" status, calculate rolled-up progress from children
- Apply the same gradient logic to parent task bars

### Files Changed
| File | Change |
|------|--------|
| `src/components/TimelineView.tsx` | Increase gradient contrast and support parent task progress display |

