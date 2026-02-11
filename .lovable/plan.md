

## Baseline Date Tracking for Slippage Visibility

### Overview

Add `baseline_start_date` and `baseline_end_date` columns to the tasks table, a "Set Baseline" button in the TableView header, and a faint gray baseline bar behind each task bar in the TimelineView to visualize schedule slippage.

---

### 1. Database Migration

Add two nullable date columns to the `tasks` table:

```sql
ALTER TABLE public.tasks
  ADD COLUMN baseline_start_date date,
  ADD COLUMN baseline_end_date date;
```

Both are nullable because tasks won't have a baseline until the user explicitly sets one.

---

### 2. Update Type Definitions

**File: `src/types/project.ts`**

Add to the `Task` interface:
- `baselineStartDate: string | null`
- `baselineEndDate: string | null`

---

### 3. Update Data Layer

**File: `src/hooks/useProjectData.ts`**

- Update `TaskRow` interface to include `baseline_start_date` and `baseline_end_date`
- Update `buildTaskTree` to map these new fields into the `Task` object
- Update `updateTask` to handle `baselineStartDate` / `baselineEndDate` mapping to DB columns
- Add a new `setBaseline` function that bulk-updates all tasks in the project, copying each task's current `start_date` / `end_date` into `baseline_start_date` / `baseline_end_date`

**File: `src/context/ProjectContext.tsx`**

- Expose `setBaseline` in the context type and provider

---

### 4. "Set Baseline" Button in TableView

**File: `src/components/TableView.tsx`**

- Add a "Set Baseline" button next to the existing "Columns" settings button in the header area
- Clicking it calls `setBaseline()` from context, which snapshots all current dates
- Use a confirmation dialog or a simple `confirm()` prompt since this overwrites any previous baseline
- Use a `Target` or `Flag` icon from lucide-react for visual identification

---

### 5. Baseline Bar in TimelineView

**File: `src/components/TimelineView.tsx`**

- In the `TaskTimelineRow` component, after rendering the main task bar, render a second bar if `task.baselineStartDate` and `task.baselineEndDate` are set
- The baseline bar will be:
  - Positioned using `getTaskPosition(baselineStartDate, baselineEndDate)`
  - Styled as a faint gray bar (`bg-muted-foreground/20`) with a dashed or solid border
  - Placed slightly below the main bar (offset `top` by ~2px) so it peeks out underneath, making slippage visually obvious
  - Thinner height (`h-5` vs the main bar's `h-7`) and `z-0` so the active bar sits on top
- Add a legend entry for "Baseline" in the timeline header alongside the existing Task/Buffer/Today legend items

---

### 6. Update Task Template

**File: `src/components/TableView.tsx`**

- Add `baselineStartDate: null` and `baselineEndDate: null` to `newTaskTemplate`

**File: `src/data/mockData.ts`**

- Add the new fields to any mock task definitions

---

### Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/...` | Add `baseline_start_date` and `baseline_end_date` columns |
| `src/types/project.ts` | Add baseline fields to `Task` interface |
| `src/hooks/useProjectData.ts` | Map new columns, add `setBaseline` bulk function |
| `src/context/ProjectContext.tsx` | Expose `setBaseline` in context |
| `src/components/TableView.tsx` | Add "Set Baseline" button, update task template |
| `src/components/TimelineView.tsx` | Render gray baseline bar underneath active bar, add legend |
| `src/data/mockData.ts` | Add baseline fields to mock data |

