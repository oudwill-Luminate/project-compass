

## Add "Responsible" Field to Tasks

### What This Does
Adds a free-text "Responsible" field to each task, allowing you to type in the name of a contractor, vendor, or other responsible party -- separate from the task Owner (who is a project member).

### Changes

**1. Database Migration**
Add one column to the `tasks` table:
- `responsible` (text, nullable, default null)

**2. Type Definition (`src/types/project.ts`)**
Add to the `Task` interface:
- `responsible: string | null`

**3. Data Layer (`src/hooks/useProjectData.ts`)**
- Add `responsible` to the `TaskRow` interface
- Map it in `buildTaskTree` when constructing Task objects
- Include it in the DB update mapping in `updateTask`
- Include it in `createTaskFull` insert
- Default to `null` in `addTask`

**4. Task Edit Dialog (`src/components/TaskDialog.tsx`)**
- Add a "Responsible" text input field below the Owner display or next to Status/Priority
- Placed in the existing layout, likely as a full-width field after the Status and Priority row
- Placeholder text: "e.g. contractor or vendor name"

**5. Table View (`src/components/TaskRow.tsx`)**
- Add a new column for "Responsible" in the grid
- Display the responsible name as text (truncated if long)
- Update the grid column template to accommodate the new column

**6. Table Header (`src/components/TableView.tsx`)**
- Add "Responsible" column header alongside the existing headers (Owner, Status, etc.)
- Update the grid template to match TaskRow

