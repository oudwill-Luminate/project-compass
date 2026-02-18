
## Fix Duration Display in Task Dialog

### Problem
When a user enters "1 day" as the duration, the end date is set to the next day (e.g., start April 1, end April 2). Users expect a 1-day task to start and end on the same day.

### Root Cause
The dialog calculates duration as `differenceInDays(endDate, startDate)` which is exclusive (Apr 1 to Apr 1 = 0). When the user types "1", it does `addDays(startDate, 1)` setting the end to the next day.

### Solution
Adjust TaskDialog.tsx to use **inclusive** duration for display and input, while keeping the underlying data model unchanged (so timeline, critical path, and other calculations continue working correctly).

### Changes

**File: `src/components/TaskDialog.tsx`**

Three targeted fixes:

1. **Duration display** (line ~93): Change from `differenceInDays(end, start)` to `differenceInDays(end, start) + 1` so a same-day task shows "1 day"

2. **Duration input handler** (line ~107): Change from `addDays(start, days)` to `addDays(start, days - 1)` so typing "1" keeps end date = start date

3. **Start date change handler** (line ~294-295): Preserve the current inclusive duration when the user picks a new start date, adjusting the `addDays` call similarly

4. **Rolled-up duration for parent tasks** (line ~247): Also add `+ 1` to the read-only rolled-up duration display for consistency

### What stays the same
- The stored `startDate` and `endDate` values in the database remain unchanged
- Timeline rendering, critical path analysis, resource leveling, and all other calculations are unaffected
- Only the TaskDialog's display of "Duration (days)" changes to be inclusive (human-intuitive)
