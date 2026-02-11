

## Fix Risk Management: Labels, Description, and Registry Display

### Problems Found

1. **No labels on risk scores**: The Impact and Probability dropdowns show only "1, 2, 3, 4, 5" with no indication of what each level means (e.g., "Negligible", "Rare").

2. **No risk description field**: There is no text box to describe the risk impact. The database also lacks a column for this.

3. **Risks not showing in Risk Registry**: The Risk Registry only checks top-level tasks for the `flaggedAsRisk` flag. If a subtask is flagged as a risk, it is invisible to the registry because it never looks inside `subTasks` arrays.

### Solution

**1. Database migration -- add `risk_description` column**

Add a `risk_description` text column (nullable, default empty string) to the `tasks` table.

**2. Update the Task type**

Add `riskDescription: string` to the `Task` interface in `src/types/project.ts`.

**3. Update data layer (`src/hooks/useProjectData.ts`)**

- Read `risk_description` from the database into `riskDescription` on the Task object
- Write `riskDescription` back as `risk_description` in `updateTask`

**4. Improve TaskDialog risk section (`src/components/TaskDialog.tsx`)**

- Change the Impact dropdown options from plain numbers to labeled options:
  - 1 -- Negligible
  - 2 -- Minor
  - 3 -- Moderate
  - 4 -- Major
  - 5 -- Severe
- Change the Probability dropdown options similarly:
  - 1 -- Rare
  - 2 -- Unlikely
  - 3 -- Possible
  - 4 -- Likely
  - 5 -- Almost Certain
- Add a **Risk Description** textarea below the dropdowns for describing the risk impact

**5. Fix Risk Registry to include subtasks (`src/components/RiskRegistry.tsx`)**

Replace the shallow `.filter()` on `b.tasks` with a recursive flatten that searches through all subtask levels, so any flagged task -- regardless of nesting depth -- appears in the registry and on the matrix.

### Files Changed

| File | Change |
|------|--------|
| Database migration | Add `risk_description` text column to `tasks` |
| `src/types/project.ts` | Add `riskDescription: string` to `Task` interface |
| `src/hooks/useProjectData.ts` | Map `risk_description` field in read/write |
| `src/components/TaskDialog.tsx` | Add labels to risk dropdowns, add risk description textarea |
| `src/components/RiskRegistry.tsx` | Flatten all tasks recursively to find flagged risks at any depth |

