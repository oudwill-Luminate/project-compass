

## Resource Leveling for the Workload View

### Overview
Add a "Level Resources" button to the Workload view that analyzes over-allocated days, identifies non-critical tasks that can be shifted (those with slack > 0), computes new suggested dates, and presents a Before vs. After confirmation modal before applying any changes.

---

### 1. Leveling Algorithm (`src/lib/resourceLeveling.ts` -- new file)

Create a pure utility function that:

1. Takes all tasks and the critical path result as input
2. Groups tasks by owner, then computes daily load per owner (same logic as WorkloadView already does)
3. For each over-allocated day per owner:
   - Finds tasks contributing to that day's load that are **non-critical** (slack > 0)
   - Sorts candidates by descending slack (most flexible first)
   - For each candidate, proposes shifting its start/end dates forward by 1+ days until the owner's load on the original day drops to 8h or below
   - The shift is constrained by the task's available slack so it never pushes the project end date
4. Returns a list of proposed changes: `{ taskId, taskTitle, ownerName, oldStart, oldEnd, newStart, newEnd }[]`

Key rules:
- Never move critical-path tasks (zero slack)
- Never shift a task beyond its slack allowance
- Preserve task duration (shift both start and end equally)
- Process owners independently

---

### 2. "Level Resources" Button (WorkloadView.tsx)

- Add a button in the header area next to the title, styled with the `outline` variant
- Icon: `Scale` from lucide-react
- Disabled when `overAllocatedCount === 0` (no leveling needed)
- On click: run the leveling algorithm, then open the confirmation modal
- If the algorithm finds no movable tasks, show a `toast.info("All over-allocated tasks are on the critical path and cannot be moved.")`

---

### 3. Confirmation Modal (`src/components/LevelResourcesDialog.tsx` -- new file)

A dialog using the existing `AlertDialog` component showing:

- **Header**: "Level Resources -- Proposed Schedule Changes"
- **Body**: A table with columns:
  - Task Name
  - Owner
  - Before (old start -- old end)
  - After (new start -- new end)
  - Shift (e.g., "+2 days")
- Each row uses subtle color coding: old dates in muted text, new dates in green
- **Footer**:
  - "Cancel" button -- closes the dialog, no changes
  - "Apply Changes" button -- calls `updateTask` for each proposed change, then shows a success toast

---

### 4. Integration

**Files to modify:**
- `src/components/WorkloadView.tsx` -- add the button, import the leveling function and dialog, compute critical path, manage dialog state
- `src/context/ProjectContext.tsx` -- no changes needed (already exposes `updateTask` and `getAllTasks`)

**Files to create:**
- `src/lib/resourceLeveling.ts` -- the pure leveling algorithm
- `src/components/LevelResourcesDialog.tsx` -- the Before vs. After confirmation modal

---

### Technical Detail: Leveling Logic Pseudocode

```text
function computeLevelingSuggestions(allTasks, slackDays, criticalIds):
  proposals = []
  
  group tasks by owner
  for each owner:
    compute dailyLoad map (date -> hours)
    sort overloaded dates chronologically
    
    for each overloaded date:
      excess = dailyLoad[date] - 8
      candidates = tasks on this date WHERE NOT critical AND slack > 0
      sort candidates by slack DESC
      
      for each candidate while excess > 0:
        taskDuration = endDate - startDate
        hoursPerDay = effortHours / durationDays
        shiftDays = min(slack, ceil(excess / hoursPerDay))
        
        propose: shift candidate forward by shiftDays
        reduce excess by hoursPerDay
        update dailyLoad to reflect the move
        
  return proposals
```

This approach is greedy but effective -- it prioritizes moving the most flexible tasks first, preserving the critical path and project end date.

