

## Quality Checklist Feature

### Overview
Add a "Quality Checklist" section to the Task Dialog where users can add, check off, and remove checklist items. When a task is marked as 100% complete (or status set to "Done"), all checklist items must be checked -- otherwise show a warning and prevent completion.

### Database Changes

**New table: `checklist_items`**
- `id` (uuid, PK, default gen_random_uuid())
- `task_id` (uuid, NOT NULL, FK to tasks.id ON DELETE CASCADE)
- `label` (text, NOT NULL)
- `checked` (boolean, NOT NULL, default false)
- `position` (integer, NOT NULL, default 0)
- `created_at` (timestamptz, default now())

**RLS policies** (using existing helper functions):
- SELECT: `is_project_member(auth.uid(), get_project_id_from_task(task_id))`
- INSERT/UPDATE/DELETE: `is_project_editor(auth.uid(), get_project_id_from_task(task_id))`

### UI Changes (TaskDialog.tsx)

1. **New "Quality Checklist" section** added between the Contingency Buffer and Risk Flag sections:
   - Header with label and item count (e.g., "Quality Checklist (2/5)")
   - List of items, each with a checkbox and label text
   - A delete button (X icon) on each item to remove it
   - An input + "Add" button at the bottom to add new items

2. **Completion guard logic** in the save handler:
   - When status is set to "Done" or progress slider reaches 100%, check if all checklist items are checked
   - If unchecked items exist, show a toast warning: "Cannot mark as complete -- X checklist items are not done"
   - Prevent the save from going through until all items are checked or the user lowers the progress/changes status

3. **Data fetching**: Load checklist items from the database when the dialog opens; save changes (add/remove/toggle) immediately via Supabase calls so items persist even if the user cancels the dialog.

### Technical Details

```text
TaskDialog
  +-- useEffect: fetch checklist_items WHERE task_id = task.id
  +-- checklistItems state: { id, label, checked, position }[]
  +-- addItem(label): INSERT into checklist_items, update local state
  +-- toggleItem(id): UPDATE checked in DB, update local state
  +-- removeItem(id): DELETE from DB, update local state
  +-- handleSave: if status=done or progress=100, verify all checked
```

### Files to Change
- **New migration**: Create `checklist_items` table with RLS
- **`src/components/TaskDialog.tsx`**: Add checklist UI section, fetch/mutate checklist items, add completion validation logic
