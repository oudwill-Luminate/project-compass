

## Methodology Gaps: Critical Path, Financial Precision, Error Handling, and Project Overview

### 1. Critical Path Highlighting (TimelineView.tsx)

**What it does:** Calculates the critical path (longest chain of dependent tasks with zero total float) and highlights those task bars with a bright orange border in the timeline.

**Implementation:**
- Add a `useMemo` in `TimelineView` that computes the critical path using a forward/backward pass algorithm:
  - **Forward pass:** For each task, compute Earliest Start (ES) and Earliest Finish (EF) by walking dependency chains
  - **Backward pass:** From the project end date, compute Latest Start (LS) and Latest Finish (LF)
  - **Total Float** = LS - ES. Tasks with float === 0 are on the critical path
- Pass a `criticalTaskIds: Set<string>` prop down to `TaskTimelineRow`
- When a task is on the critical path, apply `ring-2 ring-orange-500` to the task bar
- Add an orange legend item ("Critical Path") to the legend bar

**Files:** `src/components/TimelineView.tsx`

---

### 2. Financial Precision: Hourly Rate Auto-Calculation

**Database migration:**
- Add `hourly_rate` (numeric, default 0) column to the `profiles` table

**Data layer changes (`src/hooks/useProjectData.ts`):**
- Extend `ProfileRow` interface to include `hourly_rate: number`
- In `buildTaskTree`, when constructing each Task: if `estimated_cost` is 0 and `effort_hours > 0` and the owner has an `hourly_rate > 0`, auto-calculate `estimatedCost = effort_hours * hourly_rate`
- Pass the `profileMap` into `buildTaskTree` (already done) so it can look up rates

**Profile editing:**
- In `ProjectSettings.tsx` (or a profile settings area), add an "Hourly Rate ($)" input field so users can set their rate
- Persist via `supabase.from('profiles').update({ hourly_rate })` 

**Files:** Migration SQL, `src/hooks/useProjectData.ts`, `src/components/ProjectSettings.tsx`

---

### 3. Refined Circular Dependency Error Messages

**Current state:** Both `TaskDialog.tsx` and `useProjectData.ts` detect circular dependencies but show generic messages like "This dependency would create a loop."

**Improvement:**
- In `TaskDialog.tsx` (lines 344-358): Walk the chain and collect task titles for each node in the cycle, then display the loop path in the toast, e.g. *"Circular dependency: Task A -> Task B -> Task C -> Task A"*
- In `useProjectData.ts` (line 398): Same improvement -- collect the chain of task titles and pass them to `toast.error()` with the specific loop path

**Files:** `src/components/TaskDialog.tsx`, `src/hooks/useProjectData.ts`

---

### 4. Project Overview Tab (Charter + Goals)

**Database migration:**
- Create a `project_goals` table:
  - `id` (uuid, PK, default gen_random_uuid())
  - `project_id` (uuid, FK to projects, NOT NULL)
  - `title` (text, NOT NULL)
  - `progress` (integer, default 0, 0-100)
  - `position` (integer, default 0)
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())
- Add `charter_markdown` (text, default '') column to `projects` table
- RLS policies on `project_goals`: members can view, editors can insert/update/delete
- Enable realtime on `project_goals`

**New component:** `src/components/ProjectOverview.tsx`
- Split into two sections:
  - **Project Charter:** A textarea (or simple markdown editor) that saves `charter_markdown` on the `projects` row. Rendered as formatted markdown below the editor.
  - **Project Goals:** 3-5 goal cards, each with a title, editable progress slider (0-100%), and a progress bar. Add/remove buttons (capped at 5 goals).

**Integration:**
- Add `'overview'` to the `ViewType` union in `ProjectContext.tsx`
- Add a nav item in `Sidebar.tsx` (e.g., `FileText` icon, "Overview", positioned first)
- Render `<ProjectOverview />` in `Index.tsx` when `activeView === 'overview'`
- Add data hooks in `useProjectData.ts`: `updateCharter(markdown)`, `addGoal()`, `updateGoal()`, `deleteGoal()`, and expose via context

**Files:** Migration SQL, new `src/components/ProjectOverview.tsx`, `src/context/ProjectContext.tsx`, `src/components/Sidebar.tsx`, `src/pages/Index.tsx`, `src/hooks/useProjectData.ts`, `src/types/project.ts`

---

### Technical Summary

**Database migrations (single migration file):**
```sql
ALTER TABLE public.profiles ADD COLUMN hourly_rate numeric NOT NULL DEFAULT 0;
ALTER TABLE public.projects ADD COLUMN charter_markdown text NOT NULL DEFAULT '';

CREATE TABLE public.project_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  progress integer NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view goals" ON public.project_goals
  FOR SELECT USING (is_project_member(auth.uid(), project_id));
CREATE POLICY "Editors can insert goals" ON public.project_goals
  FOR INSERT WITH CHECK (is_project_editor(auth.uid(), project_id));
CREATE POLICY "Editors can update goals" ON public.project_goals
  FOR UPDATE USING (is_project_editor(auth.uid(), project_id));
CREATE POLICY "Editors can delete goals" ON public.project_goals
  FOR DELETE USING (is_project_editor(auth.uid(), project_id));

ALTER PUBLICATION supabase_realtime ADD TABLE public.project_goals;
```

**Files to create:**
- `src/components/ProjectOverview.tsx`

**Files to modify:**
- `src/components/TimelineView.tsx` -- critical path calculation + orange highlight
- `src/hooks/useProjectData.ts` -- hourly rate auto-calc, charter/goals CRUD, improved cycle error
- `src/components/TaskDialog.tsx` -- improved circular dependency error message
- `src/types/project.ts` -- add `ProjectGoal` interface, update `Project` interface
- `src/context/ProjectContext.tsx` -- add overview view type, charter/goals methods
- `src/components/Sidebar.tsx` -- add Overview nav item
- `src/pages/Index.tsx` -- render ProjectOverview
- `src/components/ProjectSettings.tsx` -- hourly rate input for members
