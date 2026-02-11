

## Add Task-Level Contingency Buffer Time

### What This Does
Adds the ability to set a contingency buffer (in days) on individual tasks, applied at either the start or end of the task. This extends the task's effective timeline to account for uncertainty, without changing the core work dates. The buffer will be visible on the timeline as a distinct shaded region next to the task bar.

### How It Works

Each task gets two new fields:
- **Buffer Days** -- number of contingency days (default: 0)
- **Buffer Position** -- whether the buffer goes before (start) or after (end) the task (default: "end")

For example, a "Drainage" task running Feb 10-17 with a 3-day end buffer would show:
- Core bar: Feb 10-17 (solid color)
- Buffer bar: Feb 18-20 (striped/hatched, lighter shade)

When dependency scheduling is active, the buffer is factored in. An FS dependency on a task with an end buffer means the next task starts after the buffer ends, not after the core task ends.

### Changes

**1. Database Migration**
Add two columns to the `tasks` table:
- `buffer_days` (integer, default 0, not null)
- `buffer_position` (text, default 'end', not null) -- values: 'start' or 'end'

**2. Type Definition (`src/types/project.ts`)**
Add to the `Task` interface:
- `bufferDays: number`
- `bufferPosition: 'start' | 'end'`

**3. Data Layer (`src/hooks/useProjectData.ts`)**
- Map `buffer_days` and `buffer_position` from the database in `buildTaskTree`
- Include them in `TaskRow` interface and DB update mapping in `updateTask`
- Update `scheduleTask` to factor buffer into dependency calculations:
  - For FS: dependent starts after predecessor's end + predecessor's end buffer
  - For SS: dependent starts at predecessor's start (minus start buffer if applicable)
  - Similar adjustments for FF and SF
- Include buffer fields when creating new tasks (defaults: 0 days, 'end')

**4. Task Edit Dialog (`src/components/TaskDialog.tsx`)**
Add a new "Contingency Buffer" section below the Dates/Duration row:
- A number input for buffer days
- A toggle/select for buffer position (Start / End)
- Only shown when buffer days > 0 or always visible with 0 as default

**5. Timeline View (`src/components/TimelineView.tsx`)**
- For each task with `bufferDays > 0`, render a second bar segment next to the main task bar
- Buffer bar uses the same status color but with reduced opacity and a striped pattern to visually distinguish it
- If buffer position is 'end': buffer bar appears immediately after the task bar
- If buffer position is 'start': buffer bar appears immediately before the task bar
- Tooltip includes buffer information

**6. Table View (`src/components/TaskRow.tsx`)**
- Show a small buffer indicator icon or badge next to the dates when buffer > 0
- Include buffer in rolled-up date calculations for parent tasks

