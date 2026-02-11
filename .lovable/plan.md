

## Add Sub-Tasks to the Project

### Overview
Add the ability for any task to have sub-tasks. Sub-tasks will be nested under their parent task in the table view. Costs and dates from sub-tasks will roll up to the parent task automatically.

### Database Changes

**Add `parent_task_id` column to the `tasks` table:**
- New nullable UUID column `parent_task_id` referencing `tasks.id` (self-referential foreign key)
- `ON DELETE CASCADE` so deleting a parent removes its sub-tasks
- No enum or new table needed -- sub-tasks are just tasks with a parent

### Type Changes

**`src/types/project.ts`:**
- Add `parentTaskId: string | null` and `subTasks: Task[]` to the `Task` interface

### Data Layer Changes

**`src/hooks/useProjectData.ts`:**
- Add `parent_task_id` to `TaskRow` interface
- When building the project structure, nest tasks: tasks with a `parent_task_id` become children of their parent task's `subTasks` array (only top-level tasks appear in the bucket's `tasks` array)
- `addTask` accepts an optional `parentTaskId` parameter for creating sub-tasks
- `updateTask` maps `parentTaskId` to `parent_task_id` in DB updates
- `deleteTask` works as-is (CASCADE handles children)

**`src/context/ProjectContext.tsx`:**
- Update `addTask` signature to `(bucketId: string, title: string, parentTaskId?: string)`
- Update `getAllTasks` to include sub-tasks in flattened list (for dependency dropdowns, etc.)

### UI Changes

**`src/components/TaskRow.tsx`:**
- Accept a `depth` prop (default 0) for indentation
- If the task has sub-tasks, show an expand/collapse chevron
- Render child `TaskRow` components recursively when expanded, indented by depth
- Add an "+ Add Sub-task" option in the task's dropdown menu

**`src/components/TableView.tsx`:**
- Pass `depth={0}` to top-level `TaskRow` components
- Sub-task rows are rendered by `TaskRow` itself (recursive), so no major changes here
- Subtotal calculations already sum all tasks in a bucket -- ensure sub-tasks are included

**`src/components/TaskDialog.tsx`:**
- Show parent task name if editing a sub-task
- Allow converting a standalone task into a sub-task (set parent) or vice versa

### Roll-Up Logic
- **Costs**: Parent task's estimated/actual cost = sum of its sub-tasks' costs (computed in the UI, not stored)
- **Dates**: Parent task's start date = earliest sub-task start; end date = latest sub-task end (computed in the UI)
- **Status**: If all sub-tasks are "done", parent shows "done". If any is "stuck", parent shows "stuck". Otherwise "working" if any are in progress, else "not-started"
- Roll-ups are only applied when a task has sub-tasks. Tasks without sub-tasks retain their own values.

### Drag-and-Drop
- Sub-tasks can be reordered within their parent
- Sub-tasks cannot be dragged to a different parent (keeps it simple)
- Top-level tasks can still be dragged between buckets as before

