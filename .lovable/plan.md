

## Add Milestone Support to Tasks

### What Are Milestones?

In project management (per PMI/PMBOK best practices), a **milestone** is a zero-duration checkpoint that marks a significant event -- such as a phase completion, approval gate, deliverable handoff, or go/no-go decision. Milestones differ from regular tasks in that they:

- Have **zero duration** (start date = end date)
- Represent a **point in time**, not a span of work
- Are often used as **dependency anchors** for downstream work
- Are visually distinguished (traditionally shown as a **diamond** shape on Gantt charts)
- Can still have an owner, status, and dependencies

### What Changes

**1. Database: Add `is_milestone` column to tasks table**
- New boolean column `is_milestone` (default `false`) on the `tasks` table
- No RLS changes needed -- existing task policies cover it

**2. Type Definition** (`src/types/project.ts`)
- Add `isMilestone: boolean` to the `Task` interface

**3. Data Mapping** (`src/hooks/useProjectData.ts`)
- Map `is_milestone` from the database to `isMilestone` in the Task type
- When creating or updating tasks, persist the flag
- When `isMilestone` is toggled ON, automatically set `endDate = startDate` (zero duration)

**4. Task Dialog** (`src/components/TaskDialog.tsx`)
- Add a "Mark as Milestone" toggle switch near the top of the form (below Title)
- When toggled ON:
  - Lock duration to 0 (hide end date picker and duration field)
  - Auto-set `endDate = startDate`
  - Show a small informational note: "Milestones are zero-duration checkpoints"
- When toggled OFF: restore normal date editing

**5. Table View -- Task Row** (`src/components/TaskRow.tsx`)
- Show a small diamond icon next to the task title for milestone tasks
- Dates column shows a single date instead of start/end range

**6. Timeline View** (`src/components/TimelineView.tsx`)
- Render milestones as a **diamond shape** instead of a horizontal bar
- Position the diamond at the milestone's date on the timeline
- Add a diamond to the legend

**7. Task Row Context Menu** (`src/components/TaskRow.tsx`)
- Add "Toggle Milestone" option in the dropdown menu (next to "Flag as Risk")
- Quick way to mark/unmark without opening the full dialog

### Technical Details

**Migration SQL:**
```text
ALTER TABLE tasks ADD COLUMN is_milestone boolean NOT NULL DEFAULT false;
```

**Type change (`src/types/project.ts`):**
- Add `isMilestone: boolean` after `bufferPosition`

**Hook mapping (`src/hooks/useProjectData.ts`):**
- In `mapTask`: add `isMilestone: row.is_milestone || false`
- In `updateTask` DB update: map `isMilestone` to `is_milestone`
- In `addTask` / `createTaskFull`: include `is_milestone: false` by default

**TaskDialog (`src/components/TaskDialog.tsx`):**
- Add Switch component for milestone toggle below the Title field
- When `isMilestone` is true, hide end date and duration, auto-sync `endDate = startDate`

**TaskRow (`src/components/TaskRow.tsx`):**
- Import `Diamond` from lucide-react
- Show diamond icon in the task name cell when `task.isMilestone`
- In the dropdown menu, add "Mark as Milestone" / "Remove Milestone" toggle

**TimelineView (`src/components/TimelineView.tsx`):**
- When `task.isMilestone`, render a rotated square (diamond) instead of a bar
- Diamond positioned at the task's date, sized ~14x14px, rotated 45 degrees
- Add diamond entry to the legend section

### What Stays the Same
- All scheduling and cascade logic (milestones have start = end, so cascading works naturally)
- Critical path computation (milestones are included as zero-duration tasks)
- Cost and effort tracking (milestones can still carry costs if needed)
- Sub-task hierarchy (milestones should be leaf tasks only -- if a task has sub-tasks, the milestone toggle is hidden)

