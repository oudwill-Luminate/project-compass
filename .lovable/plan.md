

## Add Task Progress Tracking

Add a percentage-based progress field to tasks that shows how much of the planned effort is complete. This applies only when a task is in the "Working on it" status.

### Database Changes

**Migration: Add `progress` column to `tasks` table**
- `progress INTEGER NOT NULL DEFAULT 0` -- value from 0 to 100

### Type Changes

**`src/types/project.ts`**
- Add `progress: number` to the `Task` interface (0-100)

### Data Layer Changes

**`src/hooks/useProjectData.ts`**
- Read `progress` from the task row in `buildTaskTree`
- Include `progress` in the `TaskRow` interface
- Write `progress` in `updateTask`
- Default new tasks to `progress: 0`

### UI Changes

**1. Task Dialog (`src/components/TaskDialog.tsx`)**
- Add a "Progress (%)" slider or number input, visible when status is "Working on it"
- Automatically reset progress to 0 when status changes away from "working", and to 100 when set to "done"

**2. Table View Status Bubble (`src/components/TaskRow.tsx`)**
- When status is "working", render the status pill with a partial fill effect:
  - Use a CSS gradient background: the left portion (progress%) filled with the solid status color, the right portion with a lighter/transparent version
  - Display the percentage text inside the pill (e.g., "Working 25%")

**3. Timeline View Bar (`src/components/TimelineView.tsx`)**
- When status is "working", show the progress as a partial fill on the task bar:
  - The left portion (progress%) of the bar is the full status color
  - The right portion is the same color but at reduced opacity (e.g., 40%)
  - This creates a clear visual indicator of how far along the task is

### Visual Example (Table View)
The "Working on it" pill currently looks like a solid orange pill. With 25% progress, the left 25% will be solid orange and the remaining 75% will be a lighter shade, making the progress immediately visible.

### Visual Example (Timeline View)
The task bar will show a solid color for the completed portion and a semi-transparent version for the remaining portion, similar to how progress bars typically render.

### Parent Task Roll-up
For parent tasks with sub-tasks, the progress will be automatically calculated as the average of all children's progress values (with "done" children counting as 100% and "not-started" counting as 0%).

### Summary of Files Changed
| File | Action |
|------|--------|
| `supabase/migrations/` | New migration adding `progress` column |
| `src/types/project.ts` | Add `progress` to Task interface |
| `src/hooks/useProjectData.ts` | Read/write progress field |
| `src/components/TaskDialog.tsx` | Add progress input when status is "working" |
| `src/components/TaskRow.tsx` | Partial-fill status pill |
| `src/components/TimelineView.tsx` | Partial-fill timeline bar |

