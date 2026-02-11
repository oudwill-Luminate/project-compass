

## Upgrade: Risk Mitigation Cost Tracking and Financial Summary

### What Already Exists (No Changes Needed)
- **Baseline dates** (`baseline_start_date`, `baseline_end_date`) -- already on tasks table and wired up
- **Effort hours** (`effort_hours`) -- already on tasks table and editable in TaskDialog
- **Weekend skipping** -- `scheduleTask` already uses `addWorkingDays`/`nextWorkingDay`/`workingDaysDiff`
- **Circular dependency detection** -- already in both `TaskDialog.tsx` and `useProjectData.ts`

### What Needs to Be Built

#### 1. Database Migration: Add `realized_cost` to tasks
- Add column `realized_cost` (numeric, default 0) to the `tasks` table

#### 2. Type Updates (`src/types/project.ts`)
- Add `realizedCost: number` to the `Task` interface

#### 3. Data Layer Updates (`src/hooks/useProjectData.ts`)
- Map `realized_cost` from DB rows to `realizedCost` on the Task object in `buildTaskTree`
- Add `realized_cost` to the `updateTask` DB field mapping

#### 4. Risk Registry: Realized Mitigation Cost Input (`src/components/RiskRegistry.tsx`)
- Add a "Realized Mitigation Cost ($)" number input to each expanded risk task card
- On change, call `updateTask(taskId, { realizedCost: value })` to persist

#### 5. Financial Summary Enhancement (`src/components/TableView.tsx`)
- Compute `totalRealizedRiskCost` = sum of `realizedCost` for all tasks where `flaggedAsRisk` is true
- Compute `remainingContingency` = `contingencyAmount - totalRealizedRiskCost`
- Add two new cards to the financial summary grid:
  - **Total Realized Risk Cost** -- displays the sum, styled in amber/red
  - **Remaining Contingency** -- displays the remaining amount, red if negative
- Highlight the "Actual Cost" card in red if `actualCost + realizedRiskCost > estimatedCost` for any task (already partially done; extend to include realized cost)

#### 6. TaskDialog Updates (`src/components/TaskDialog.tsx`)
- Add `realizedCost` to formData initialization
- Include `realizedCost` in the save/update payload
- Add a "Realized Mitigation Cost ($)" input in the Costs section (only visible when `flaggedAsRisk` is true)

#### 7. Task Row: Red Highlight on Actual Column (`src/components/TaskRow.tsx`)
- When rendering the "actual" cost cell, apply red text if `task.actualCost + task.realizedCost > task.estimatedCost`

### Technical Details

**Migration SQL:**
```sql
ALTER TABLE public.tasks ADD COLUMN realized_cost numeric NOT NULL DEFAULT 0;
```

**Files to modify:**
- New migration for `realized_cost` column
- `src/types/project.ts` -- add `realizedCost` field
- `src/hooks/useProjectData.ts` -- map and persist `realizedCost`
- `src/components/TaskDialog.tsx` -- add input for realized cost (when flagged as risk)
- `src/components/TaskRow.tsx` -- red highlight logic on actual cost cell
- `src/components/RiskRegistry.tsx` -- add realized cost input per risk task
- `src/components/TableView.tsx` -- add Total Realized Risk Cost and Remaining Contingency to financial summary

