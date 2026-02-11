
## Methodology Gaps — COMPLETED

All 4 methodology gaps have been implemented:

### 1. ✅ Critical Path Highlighting (TimelineView.tsx)
- Forward/backward pass algorithm calculates ES, EF, LS, LF for leaf tasks
- Tasks with zero total float highlighted with `ring-2 ring-orange-500`
- Orange "Critical Path" legend item added

### 2. ✅ Financial Precision: Hourly Rate Auto-Calculation
- `hourly_rate` column added to `profiles` table
- Auto-calc in `buildTaskTree`: if `estimated_cost === 0 && effort_hours > 0 && owner.hourly_rate > 0`, cost = hours × rate
- Hourly rate editor added to Project Settings

### 3. ✅ Refined Circular Dependency Error Messages
- Both `TaskDialog.tsx` and `useProjectData.ts` now trace the full cycle path
- Toast displays: "Circular dependency: Task A → Task B → Task C → Task A"

### 4. ✅ Project Overview Tab (Charter + Goals)
- `charter_markdown` column added to `projects` table
- `project_goals` table created with RLS policies
- `ProjectOverview.tsx` component with markdown charter textarea + goal cards with progress sliders
- "Overview" nav item added to sidebar (first position)
- `ViewType` extended with `'overview'`
