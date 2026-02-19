

## Fix: TaskDialog Duration Ignores Weekend Exclusion

### Root Cause

The TaskDialog calculates and displays duration using **calendar days** (`differenceInDays + 1`), completely ignoring the project's "Include Weekends" setting. When weekends are excluded:

- A task from May 8 (Fri) to May 12 (Tue) shows as **5 days** (calendar), but is actually **3 working days** (Fri, Mon, Tue)
- When the user types "5" in the duration field, it computes `May 8 + 4 calendar days = May 12`, which is only 3 working days -- not 5

The same mismatch exists in the scheduling engine (both JS and SQL), which uses `working_days_diff` (non-inclusive of start day). So the cascade RPC sees the task as having 2 working-day duration, preserves that, and the dates never match what the user intended.

### The Fix

Make the TaskDialog respect `includeWeekends` in three places:

**File: `src/components/TaskDialog.tsx`**

1. **Pull `project` from context** (line 65):
   ```text
   const { updateTask, getAllTasks, members, project } = useProject();
   ```

2. **Duration display** (line 92-96) -- count working days when weekends are excluded:
   ```text
   const duration = useMemo(() => {
     try {
       if (project.includeWeekends) {
         return differenceInDays(parseISO(formData.endDate), parseISO(formData.startDate)) + 1;
       }
       // Count only working days (inclusive of start and end)
       let count = 0;
       let d = parseISO(formData.startDate);
       const end = parseISO(formData.endDate);
       while (d <= end) {
         if (d.getDay() !== 0 && d.getDay() !== 6) count++;
         d = addDays(d, 1);
       }
       return Math.max(count, 1);
     } catch { return 1; }
   }, [formData.startDate, formData.endDate, project.includeWeekends]);
   ```

3. **Duration change handler** (line 104-111) -- add working days when setting end date:
   ```text
   const handleDurationChange = (val: string) => {
     setDurationInput(val);
     const days = parseInt(val, 10);
     if (!isNaN(days) && days > 0) {
       let newEnd: Date;
       if (project.includeWeekends) {
         newEnd = addDays(parseISO(formData.startDate), days - 1);
       } else {
         // Add (days - 1) working days from start
         let remaining = days - 1; // start day counts as day 1
         newEnd = parseISO(formData.startDate);
         while (remaining > 0) {
           newEnd = addDays(newEnd, 1);
           if (newEnd.getDay() !== 0 && newEnd.getDay() !== 6) remaining--;
         }
       }
       setFormData(prev => ({ ...prev, endDate: format(newEnd, 'yyyy-MM-dd') }));
     }
   };
   ```

4. **Rolled-up parent duration** (line 302) -- also use working days for parent tasks:
   ```text
   const rolledDuration = project.includeWeekends
     ? differenceInDays(parseISO(rolledEnd), parseISO(rolledStart)) + 1
     : (() => {
         let count = 0;
         let d = parseISO(rolledStart);
         const end = parseISO(rolledEnd);
         while (d <= end) {
           if (d.getDay() !== 0 && d.getDay() !== 6) count++;
           d = addDays(d, 1);
         }
         return Math.max(count, 1);
       })();
   ```

### Result

- Duration field will show **3** for a Fri-to-Tue task (working days) instead of **5** (calendar days)
- Typing "5" will compute end date as the 5th working day from start (skipping weekends)
- The scheduling engine and UI will be in agreement on duration semantics

### Files Changed

- `src/components/TaskDialog.tsx`: Use working-day-aware duration calculation and input handling

### What Stays the Same

- All scheduling engine code (already uses working days correctly)
- Cascade RPC (unchanged)
- Database schema and RLS policies (unchanged)
- Reconciliation logic (unchanged)
