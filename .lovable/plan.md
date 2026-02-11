

## Slack Visualization Enhancements

### What's Already Done
- The backward-pass calculation already exists in `src/lib/criticalPath.ts` and produces a `slackDays` map
- The "Slack" column already exists in `tableColumns.ts` and renders in `TaskRow.tsx`
- `TableView.tsx` already computes and passes `slackDays` to each `TaskRow`

### What Needs to Change

#### 1. Centralize slack computation in `useProjectData.ts`
Move the `computeCriticalPath` call out of individual views and into the project data hook so all views share the same computed slack data. This avoids redundant recalculation across TableView and TimelineView.

- Add a `useMemo` in `useProjectData` that calls `computeCriticalPath` on all flattened tasks
- Expose `slackDays` and `criticalTaskIds` from the hook's return value
- Update `TableView.tsx` and `TimelineView.tsx` to consume these from the project context instead of computing locally

#### 2. Expose slack data via `ProjectContext`
Add `slackDays` and `criticalTaskIds` to the context value so any component can access them.

#### 3. Add dotted slack line in `TimelineView.tsx`
For each leaf task with positive slack (slack > 0), render a thin dotted/dashed line extending from the end of the task bar to the right, spanning the number of slack days. This shows the "safety window" -- how far the task could slip without affecting the project end date.

- Pass `slackDays` map into `TaskTimelineRow`
- After the task bar, render a new `div` with a dashed border style
- Width calculated as `(slackDays / totalDays) * 100%`
- Positioned starting at the right edge of the task bar
- Styled as a thin dashed line in a muted color (e.g., `border-dashed border-muted-foreground/40`)
- Add a tooltip showing "Slack: X days"
- Only rendered for leaf tasks (no sub-tasks)

#### 4. Update Timeline legend
Add a "Slack" entry to the legend showing the dotted line style.

---

### Technical Details

**Files to modify:**
- `src/hooks/useProjectData.ts` -- add `computeCriticalPath` call, return `slackDays` and `criticalTaskIds`
- `src/context/ProjectContext.tsx` -- expose `slackDays` and `criticalTaskIds` in context
- `src/components/TimelineView.tsx` -- consume from context, pass `slackDays` to row, render dotted slack line, update legend
- `src/components/TableView.tsx` -- remove local `computeCriticalPath` call, use context instead

**No database changes required.**

