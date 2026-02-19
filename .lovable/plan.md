

## Non-Overlap (Exclusion) Links Between Tasks

### Background (PM Best Practices)

In construction project management, there are situations where two tasks have no logical dependency (neither is a predecessor of the other) but they **cannot run at the same time** due to shared space, equipment, or crew constraints. For example, HVAC ductwork and electrical rough-in in the same room -- both could technically start anytime, but the crews can't physically occupy the same space simultaneously.

In PMBOK and tools like Primavera P6, this is handled through **resource constraints** or **exclusion links** -- relationships that say "these two tasks must not overlap" without implying a logical sequence. The scheduler then automatically sequences them based on priority or existing dates.

This is distinct from:
- **Dependencies** (logical: "B can't start until A finishes because B needs A's output")
- **Schedule Constraints** (date-based: "B can't start before March 15")
- **Exclusion Links** (resource/space: "A and B can't happen at the same time")

### How It Works

1. A user opens a task and adds an "exclusion link" to another task (e.g., "Cannot overlap with: Electrical Rough-In")
2. The link is bidirectional -- it doesn't matter which task you add it from
3. During scheduling/reconciliation, if two exclusion-linked tasks overlap, the system shifts the one that starts later to begin after the earlier one finishes (FS-style gap)
4. A distinct visual indicator (crossed-arrows icon) appears on linked tasks in the Table and Timeline views

### What Changes

**1. Database: New `task_exclusions` table**
- `id` (PK), `task_a_id`, `task_b_id` (both reference `tasks.id`)
- `created_at` timestamp
- Unique constraint on `(task_a_id, task_b_id)` with a CHECK ensuring `task_a_id < task_b_id` to prevent duplicate/reversed pairs
- RLS policies mirroring task policies
- Realtime enabled

**2. Types (`src/types/project.ts`)**
- Add `exclusionLinks: string[]` to the `Task` interface (list of task IDs this task cannot overlap with)

**3. Data layer (`src/hooks/useProjectData.ts`)**
- Fetch `task_exclusions` alongside tasks in `fetchAll`
- Populate each task's `exclusionLinks` array
- After dependency + constraint reconciliation, add a second pass that checks all exclusion pairs for date overlap and shifts the later-starting task to begin after the earlier one finishes
- `updateTask`: when exclusion links change, write to `task_exclusions` table (insert/delete rows)
- Subscribe to realtime changes on `task_exclusions`

**4. Cascade RPC (`cascade_task_dates`)**
- Add exclusion-aware logic: after cascading dependency-based dates, check if the resulting dates overlap with any exclusion-linked task and shift accordingly

**5. Task Dialog UI (`src/components/TaskDialog.tsx`)**
- Add a "Non-Overlap Links" section below Dependencies:
  - A list of linked tasks with remove buttons
  - "Add Non-Overlap Link" button to select a task that cannot overlap
  - Tasks already linked via dependencies are excluded from the selection (they're already sequenced)
  - Distinct icon (e.g., `Ban` or `Shuffle` from lucide) to differentiate from dependencies

**6. Task Row (`src/components/TaskRow.tsx`)**
- Show a small exclusion icon with count when non-overlap links exist
- Tooltip lists the linked task names

**7. Timeline View (`src/components/TimelineView.tsx`)**
- Exclusion-linked tasks get a subtle visual marker (different from the dependency/critical path indicators)

### Technical Details

**Migration SQL:**
```text
CREATE TABLE task_exclusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_a_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  task_b_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(task_a_id, task_b_id),
  CHECK(task_a_id < task_b_id)
);

ALTER TABLE task_exclusions ENABLE ROW LEVEL SECURITY;

-- RLS policies using get_project_id_from_task
CREATE POLICY "Members can view exclusions"
  ON task_exclusions FOR SELECT
  USING (is_project_member(auth.uid(), get_project_id_from_task(task_a_id)));

CREATE POLICY "Editors can insert exclusions"
  ON task_exclusions FOR INSERT
  WITH CHECK (is_project_editor(auth.uid(), get_project_id_from_task(task_a_id)));

CREATE POLICY "Editors can delete exclusions"
  ON task_exclusions FOR DELETE
  USING (is_project_editor(auth.uid(), get_project_id_from_task(task_a_id)));

ALTER PUBLICATION supabase_realtime ADD TABLE task_exclusions;
```

**Reconciliation logic (exclusion pass):**
```text
// After dependency + constraint reconciliation...
for (const task of allTasksFlat) {
  for (const linkedId of task.exclusionLinks) {
    const linked = allTasksFlat.find(t => t.id === linkedId);
    if (!linked) continue;
    // Check overlap: tasks overlap if one starts before the other ends
    if (task.startDate <= linked.endDate && task.endDate >= linked.startDate) {
      // Shift the later-starting task to after the earlier one finishes
      if (task.startDate >= linked.startDate) {
        task.startDate = nextWorkingDay(addDays(parseISO(linked.endDate), 1));
        task.endDate = addWorkingDays(task.startDate, duration);
        // Persist the shift
      }
    }
  }
}
```

**Cascade RPC update:**
```text
-- After computing final dates for a successor, check exclusion pairs:
FOR excl IN
  SELECT CASE WHEN task_a_id = dep.succ_id THEN task_b_id ELSE task_a_id END AS other_id
  FROM task_exclusions
  WHERE task_a_id = dep.succ_id OR task_b_id = dep.succ_id
LOOP
  SELECT start_date, end_date INTO other_start, other_end
  FROM tasks WHERE id = excl.other_id;
  
  IF final_s <= other_end AND new_e >= other_start THEN
    -- Overlap detected: shift successor after the other task
    final_s := next_working_day(other_end + 1, _include_weekends);
    new_e := add_working_days(final_s, dep_duration, _include_weekends);
  END IF;
END LOOP;
```

### Files Changed
- **1 migration file**: new `task_exclusions` table + RLS + updated `cascade_task_dates` RPC
- `src/types/project.ts`: add `exclusionLinks` to `Task` interface
- `src/hooks/useProjectData.ts`: fetch exclusions, reconciliation pass, CRUD, realtime subscription
- `src/components/TaskDialog.tsx`: non-overlap links UI section
- `src/components/TaskRow.tsx`: exclusion indicator icon
- `src/components/TimelineView.tsx`: exclusion marker on bars
- `src/data/mockData.ts`: add default `exclusionLinks: []` field

### What Stays the Same
- Dependency logic (unchanged -- exclusions are a separate layer)
- Schedule constraints (unchanged)
- Buffer and milestone logic (unchanged)
- Critical path calculation (unchanged)
- All existing RLS policies (unchanged)

