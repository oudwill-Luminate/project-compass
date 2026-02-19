

## Task Date Constraints (Manual Scheduling Override)

### Background (PM Best Practices)

In PMBOK and standard scheduling tools (MS Project, Primavera P6), every task has a **constraint type** that controls how the scheduler treats its dates. Currently, all tasks behave as "As Soon As Possible" (ASAP) -- they start at the earliest date allowed by their dependencies. But in construction and trade-based projects, you often need to say things like:

- "The electricians can't come until March 15" (Start No Earlier Than)
- "The inspection must happen on April 1" (Must Start On)
- "We need framing done by March 20 at the latest" (Finish No Later Than)

These constraints work **alongside** dependencies -- the scheduler honors whichever is more restrictive.

### Constraint Types

The following constraint types will be supported:

| Constraint | Meaning | Scheduler Behavior |
|---|---|---|
| **ASAP** (default) | As Soon As Possible | Start date is fully driven by dependencies |
| **SNET** | Start No Earlier Than | Start date = max(dependency date, constraint date) |
| **SNLT** | Start No Later Than | Start date = min(dependency date, constraint date) -- warns if conflict |
| **MSO** | Must Start On | Start date is locked to the constraint date -- warns if dependency conflict |
| **MFO** | Must Finish On | End date is locked; start is back-calculated from duration |
| **FNET** | Finish No Earlier Than | End date = max(calculated end, constraint date) |
| **FNLT** | Finish No Later Than | End date = min(calculated end, constraint date) -- warns if conflict |

### How It Works

When a task has a constraint:
1. The dependency engine calculates the "ideal" start/end as usual
2. The constraint is then applied on top:
   - For "No Earlier Than" types: the task uses whichever date is **later** (dependency or constraint)
   - For "No Later Than" types: the task uses whichever date is **earlier**, and a warning indicator appears if the constraint conflicts with a dependency
   - For "Must" types: the constraint date wins unconditionally, with a conflict warning if dependencies disagree

A small constraint icon and date will appear on constrained tasks in the Table and Timeline views so it's visually clear which tasks are manually pinned.

### What Changes

**1. Database: Add constraint columns to `tasks` table**
- `constraint_type` (enum: ASAP, SNET, SNLT, MSO, MFO, FNET, FNLT, default ASAP)
- `constraint_date` (date, nullable -- only required when type is not ASAP)

**2. Types (`src/types/project.ts`)**
- Add `ScheduleConstraint` type and config
- Add `constraintType` and `constraintDate` fields to the `Task` interface

**3. Data layer (`src/hooks/useProjectData.ts`)**
- Map the new columns in `buildTaskTree`
- Update the reconciliation loop to apply constraints after computing the dependency-based start:
  - ASAP: no change (current behavior)
  - SNET: `finalStart = max(dependencyStart, constraintDate)`
  - MSO: `finalStart = constraintDate` (ignore dependency)
  - MFO: `finalEnd = constraintDate`, back-calculate start from duration
  - SNLT/FNET/FNLT: apply min/max logic accordingly
- Preserve duration in all cases
- Update `updateTask` to persist `constraint_type` and `constraint_date`

**4. Cascade RPC (`cascade_task_dates`)**
- Update the PostgreSQL function to read `constraint_type` and `constraint_date` for each successor
- Apply the constraint logic server-side during cascading

**5. Task Dialog UI (`src/components/TaskDialog.tsx`)**
- Add a "Schedule Constraint" section with:
  - A dropdown for constraint type (defaults to ASAP)
  - A date picker for the constraint date (shown when type is not ASAP)
  - A help tooltip explaining each constraint type
- When ASAP is selected, the constraint date field is hidden

**6. Task Row (`src/components/TaskRow.tsx`)**
- Show a small pin/lock icon next to the date for constrained tasks
- Tooltip shows the constraint type and date
- If there's a conflict (constraint vs dependency), show a warning indicator

**7. Timeline View (`src/components/TimelineView.tsx`)**
- Constrained tasks get a small constraint marker (pin icon) on their bar
- Conflict indicator if the constraint date conflicts with dependencies

### Technical Details

**Migration SQL:**
```text
-- Create constraint type enum
CREATE TYPE schedule_constraint AS ENUM (
  'ASAP', 'SNET', 'SNLT', 'MSO', 'MFO', 'FNET', 'FNLT'
);

-- Add columns to tasks
ALTER TABLE tasks
  ADD COLUMN constraint_type schedule_constraint NOT NULL DEFAULT 'ASAP',
  ADD COLUMN constraint_date date;
```

**Reconciliation logic change (pseudocode):**
```text
// After computing latestStart from dependencies...
let finalStart = latestStart || task.startDate;
let finalEnd = task.endDate;

switch (task.constraintType) {
  case 'SNET':
    if (task.constraintDate > finalStart) finalStart = task.constraintDate;
    // Recalculate end from duration
    break;
  case 'MSO':
    finalStart = task.constraintDate; // Override dependency
    break;
  case 'MFO':
    finalEnd = task.constraintDate;
    // Back-calculate start from duration
    break;
  case 'FNET':
    if (task.constraintDate > calculatedEnd) finalEnd = task.constraintDate;
    break;
  // ... etc
}
```

**Cascade RPC update (key addition):**
```text
-- After computing dependency-based new_s and new_e for a successor:
SELECT constraint_type, constraint_date INTO v_ct, v_cd FROM tasks WHERE id = succ_id;
IF v_ct = 'SNET' AND v_cd > new_s THEN
  new_s := v_cd;
  new_e := new_s + duration;
ELSIF v_ct = 'MSO' THEN
  new_s := v_cd;
  new_e := new_s + duration;
-- ... other constraint types
END IF;
```

### Files Changed
- **1 migration file**: add `schedule_constraint` enum + columns + updated `cascade_task_dates` RPC
- `src/types/project.ts`: add constraint types and fields
- `src/hooks/useProjectData.ts`: mapping, reconciliation with constraints, updateTask
- `src/components/TaskDialog.tsx`: constraint UI (dropdown + date picker)
- `src/components/TaskRow.tsx`: constraint indicator icon
- `src/components/TimelineView.tsx`: constraint marker on bars
- `src/data/mockData.ts`: add default constraint fields

### What Stays the Same
- Dependency logic (unchanged -- constraints layer on top)
- Buffer logic (unchanged)
- Milestone logic (unchanged)
- Critical path calculation (unchanged -- constraints just affect the dates fed into it)
- Resource leveling (unchanged)
- All RLS policies on existing tables (unchanged)
