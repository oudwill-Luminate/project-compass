

## Scheduling Refinements: Circular Dependency Detection, Working-Day Logic, and Weekend Toggle

### Overview

This plan covers three related improvements:
1. Detect circular dependencies before saving and show an error toast
2. Update the `scheduleTask` function to skip weekends (Sat/Sun) by default
3. Add a toggle in Project Settings to include weekends as working days

---

### 1. Database Migration

Add a `include_weekends` boolean column to the `projects` table:

```sql
ALTER TABLE public.projects
  ADD COLUMN include_weekends boolean NOT NULL DEFAULT false;
```

No new RLS policies needed -- existing project update/select policies cover this column.

---

### 2. Type Updates

**`src/types/project.ts`** -- Add `includeWeekends` to the `Project` interface:

```typescript
export interface Project {
  id: string;
  name: string;
  contingencyPercent: number;
  includeWeekends: boolean;
  buckets: Bucket[];
}
```

---

### 3. Scheduling Logic (`src/hooks/useProjectData.ts`)

**a) Circular dependency detection function**

Add a `detectCircularDependency` helper that walks the dependency chain from a given task. If it encounters the starting task again, a cycle exists.

```typescript
function detectCircularDependency(
  taskId: string,
  proposedDependsOn: string,
  allTasks: Task[]
): boolean {
  const visited = new Set<string>();
  let current: string | null = proposedDependsOn;
  while (current) {
    if (current === taskId) return true; // cycle found
    if (visited.has(current)) break;
    visited.add(current);
    const task = allTasks.find(t => t.id === current);
    current = task?.dependsOn ?? null;
  }
  return false;
}
```

**b) Use it in `updateTask`** -- When `dependsOn` changes, check for cycles before proceeding. If detected, show `toast.error('Circular dependency detected...')` and return early without saving.

**c) Working-day-aware scheduling**

Add an `addWorkingDays` helper that skips Saturdays and Sundays (when `includeWeekends` is false), and a `workingDaysDiff` helper to count working days between two dates.

```typescript
function addWorkingDays(start: Date, days: number, includeWeekends: boolean): Date {
  if (includeWeekends) return addDays(start, days);
  let result = start;
  let remaining = Math.abs(days);
  const direction = days >= 0 ? 1 : -1;
  while (remaining > 0) {
    result = addDays(result, direction);
    const day = result.getDay();
    if (day !== 0 && day !== 6) remaining--;
  }
  return result;
}

function nextWorkingDay(date: Date, includeWeekends: boolean): Date {
  if (includeWeekends) return date;
  let d = date;
  while (d.getDay() === 0 || d.getDay() === 6) d = addDays(d, 1);
  return d;
}
```

Update `scheduleTask` to accept an `includeWeekends` parameter:
- Calculate duration in working days (not calendar days)
- Use `addWorkingDays` instead of `addDays` for the new start/end dates
- Ensure the resulting start date lands on a working day

**d) Pass `includeWeekends` through** -- The `updateTask` function reads `project.includeWeekends` and passes it to `scheduleTask` and the cascade logic.

---

### 4. Data Loading (`useProjectData`)

In `fetchAll`, map the new DB column into the Project object:

```typescript
const proj: Project = {
  ...
  includeWeekends: projData.include_weekends ?? false,
  ...
};
```

Add an `updateIncludeWeekends` function (similar to `updateContingency`):

```typescript
const updateIncludeWeekends = useCallback(async (value: boolean) => {
  if (!projectId) return;
  setProject(prev => prev ? { ...prev, includeWeekends: value } : prev);
  await supabase.from('projects').update({ include_weekends: value }).eq('id', projectId);
}, [projectId]);
```

Return it from the hook and expose it through `ProjectContext`.

---

### 5. Project Settings UI (`src/components/ProjectSettings.tsx`)

Add a Switch toggle below the Contingency field:

```
Include Weekends
[toggle switch]
When enabled, Saturdays and Sundays are treated as working days for scheduling.
```

- Uses the `Switch` component from `@/components/ui/switch`
- Calls `updateIncludeWeekends` directly on toggle (no need for the Save button -- instant save like a preference)
- OR: track it as part of `hasChanges` and save with the existing Save button

The toggle will be added between the Contingency section and the Save button.

---

### 6. Context Updates (`src/context/ProjectContext.tsx`)

- Add `updateIncludeWeekends` to `ProjectContextType` interface
- Wire it through the provider from the hook

---

### Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/...` | Add `include_weekends` column |
| `src/types/project.ts` | Add `includeWeekends` to `Project` |
| `src/hooks/useProjectData.ts` | Circular detection, working-day helpers, `updateIncludeWeekends`, pass `includeWeekends` to scheduling |
| `src/context/ProjectContext.tsx` | Expose `updateIncludeWeekends` |
| `src/components/ProjectSettings.tsx` | Add weekend toggle switch |

