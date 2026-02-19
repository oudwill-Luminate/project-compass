

## Support Multiple Dependencies per Task

### Background (PM Best Practices)

In standard project management (PMBOK, CPM methodology), a task can have **multiple predecessors**. For example, "Begin Testing" might depend on both "Development Complete" (FS) and "Test Environment Ready" (FS). Each dependency link has its own type (FS, FF, SS, SF). The dependent task's start is constrained by the **most restrictive** (latest) predecessor -- meaning the task cannot start until all its predecessors are satisfied.

Currently, each task stores a single `depends_on` UUID and a single `dependency_type`. This limits scheduling to linear chains and prevents realistic network diagrams.

### Solution Overview

Introduce a **junction table** (`task_dependencies`) to store one row per dependency link, each with its own dependency type. Migrate existing single-dependency data into this table, then update all scheduling, cascading, critical path, and UI logic to work with arrays of dependencies.

### What Changes

**1. Database: New `task_dependencies` junction table**
- Columns: `id` (PK), `task_id` (the dependent), `predecessor_id` (the predecessor), `dependency_type` (FS/FF/SS/SF), `created_at`
- Foreign keys to `tasks` on both `task_id` and `predecessor_id`
- Unique constraint on `(task_id, predecessor_id)` to prevent duplicates
- RLS policies mirroring existing task policies (using `get_project_id_from_task`)
- Migration step: copy existing `depends_on`/`dependency_type` data into the new table
- Keep the old `depends_on` and `dependency_type` columns temporarily for safety (mark deprecated)

**2. Type changes (`src/types/project.ts`)**
- Add a new interface:
```text
interface TaskDependency {
  predecessorId: string;
  type: DependencyType;
}
```
- Add `dependencies: TaskDependency[]` to the `Task` interface
- Keep `dependsOn` and `dependencyType` as deprecated (for backward compat during transition)

**3. Data layer (`src/hooks/useProjectData.ts`)**
- Fetch `task_dependencies` rows alongside tasks in `fetchAll`
- Populate `task.dependencies` array from the junction table
- Set `task.dependsOn` to the first dependency's predecessorId (backward compat)
- **Reconciliation loop**: iterate over each dependency in `task.dependencies`, compute the scheduled start for each, then take the **latest** (most restrictive) start date
- **Circular detection**: update to perform a full graph BFS/DFS through `dependencies` arrays (not just single `dependsOn` chain)
- **updateTask**: when dependencies change, write to `task_dependencies` table (insert/delete rows) instead of updating `depends_on` column
- **Cascade logic**: when dates/buffer change, the `cascade_task_dates` RPC needs updating (see below)

**4. Cascade RPC (`cascade_task_dates`)**
- Update the PostgreSQL function to look up predecessors from `task_dependencies` instead of the `depends_on` column
- For each successor, find **all** its predecessors, compute the scheduled start from each, and take the latest (most restrictive) one
- This ensures the cascade correctly handles tasks with multiple predecessors

**5. Critical path (`src/lib/criticalPath.ts`)**
- **Forward pass**: `getES` must consider all predecessors (max of all predecessor EFs + 1 day)
- **Backward pass**: successor map built from all dependency links
- Both passes naturally extend to multiple predecessors with minimal logic changes

**6. Task Dialog UI (`src/components/TaskDialog.tsx`)**
- Replace the single "Depends On" dropdown with a **multi-dependency list**
- Each dependency row shows: predecessor selector + dependency type selector + remove button
- "Add Dependency" button to add another row
- Circular dependency check runs against all proposed dependencies before saving
- On save: compute the diff (added/removed dependencies) and write to `task_dependencies`

**7. Task Row (`src/components/TaskRow.tsx`)**
- Dependency link icon shows count when multiple dependencies exist (e.g., link icon with "3")
- Tooltip lists all predecessor names

**8. Timeline View (`src/components/TimelineView.tsx`)**
- Dependency arrows render for each dependency link (not just one)

### Technical Details

**Migration SQL:**
```text
-- Create junction table
CREATE TABLE task_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  predecessor_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  dependency_type dependency_type NOT NULL DEFAULT 'FS',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(task_id, predecessor_id),
  CHECK(task_id != predecessor_id)
);

-- Enable RLS
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Members can view task dependencies"
  ON task_dependencies FOR SELECT
  USING (is_project_member(auth.uid(), get_project_id_from_task(task_id)));

CREATE POLICY "Editors can insert task dependencies"
  ON task_dependencies FOR INSERT
  WITH CHECK (is_project_editor(auth.uid(), get_project_id_from_task(task_id)));

CREATE POLICY "Editors can update task dependencies"
  ON task_dependencies FOR UPDATE
  USING (is_project_editor(auth.uid(), get_project_id_from_task(task_id)));

CREATE POLICY "Editors can delete task dependencies"
  ON task_dependencies FOR DELETE
  USING (is_project_editor(auth.uid(), get_project_id_from_task(task_id)));

-- Migrate existing data
INSERT INTO task_dependencies (task_id, predecessor_id, dependency_type)
SELECT id, depends_on, dependency_type
FROM tasks
WHERE depends_on IS NOT NULL;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE task_dependencies;
```

**Updated `cascade_task_dates` RPC (key change):**
```text
-- Instead of: SELECT ... FROM tasks WHERE depends_on = current_id
-- Use: SELECT td.task_id, td.dependency_type, t.start_date, t.end_date
--      FROM task_dependencies td
--      JOIN tasks t ON t.id = td.task_id
--      WHERE td.predecessor_id = current_id
-- For each successor, also check ALL its other predecessors
-- to pick the latest (most restrictive) start date
```

**Reconciliation loop change:**
```text
for (const task of allTasksFlat) {
  if (task.dependencies.length === 0) continue;
  // Compute scheduled start from EACH predecessor
  let latestStart = null;
  for (const dep of task.dependencies) {
    const pred = allTasksFlat.find(t => t.id === dep.predecessorId);
    if (!pred) continue;
    const eff = getEffectiveDates(pred);
    const scheduled = scheduleTask(..., dep.type, ...);
    if (!latestStart || scheduled.startDate > latestStart) {
      latestStart = scheduled.startDate;
    }
  }
  // Only update if latestStart differs, preserving duration
}
```

**Critical path forward pass change:**
```text
const getES = (id) => {
  const t = taskMap.get(id);
  if (t.dependencies.length === 0) return parseISO(t.startDate);
  // ES = max of all predecessor EFs + 1 day
  const earliest = Math.max(
    ...t.dependencies.map(d => getEF(d.predecessorId) + DAY_MS)
  );
  return earliest;
};
```

### Files Changed
- **1 migration file**: new `task_dependencies` table + data migration + updated `cascade_task_dates` RPC
- `src/types/project.ts`: add `TaskDependency` interface and `dependencies` array
- `src/hooks/useProjectData.ts`: fetch dependencies, reconciliation, circular detection, cascade, CRUD
- `src/lib/criticalPath.ts`: multi-predecessor forward/backward pass
- `src/components/TaskDialog.tsx`: multi-dependency UI
- `src/components/TaskRow.tsx`: dependency count display
- `src/components/TimelineView.tsx`: multiple dependency arrows
- `src/context/ProjectContext.tsx`: minor type updates if needed
- `src/data/mockData.ts`: add `dependencies` field to mock data

### What Stays the Same
- Buffer logic (unchanged)
- Milestone logic (unchanged)
- Sub-task hierarchy and roll-up (unchanged)
- Bucket CRUD (unchanged)
- Activity logging (unchanged)
- RLS on all other tables (unchanged)

