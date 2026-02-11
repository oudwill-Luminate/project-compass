
## Open Full Task Dialog When Adding a New Task

### What Changes
Instead of showing an inline text input when clicking "+ Add Task", the app will immediately open the full task edit dialog pre-populated with defaults. This lets you set all task properties (dates, priority, costs, buffer, dependencies, etc.) right away in one step.

### How It Works
1. Clicking "+ Add Task" creates the task with default values (same as today) and immediately opens the TaskDialog for that newly created task
2. You can edit all fields in the dialog before the task is saved
3. Clicking "Save" commits the task; clicking "Cancel" removes it

### Technical Details

**`src/components/TableView.tsx`:**
- Remove the `InlineInput` flow for adding tasks
- When "+ Add Task" is clicked, call `addTask(bucketId, "New Task")` to create a task with defaults
- Track the newly created task's ID in state (e.g., `pendingNewTaskId`)
- Once the task appears in the project data, open `TaskDialog` for it automatically
- If the user cancels the dialog, delete the task via `deleteTask`

**`src/components/TaskDialog.tsx`:**
- Add an optional `isNew` prop to indicate this is a brand-new task
- When `isNew` is true and the user cancels, signal to the parent that the task should be deleted
- Add an `onDelete` callback prop for this purpose

No database or type changes are needed -- the existing `addTask` and `deleteTask` functions handle everything.
