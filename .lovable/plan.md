

## Project Activity Audit Trail

### Overview
Create an `activity_log` table to automatically track changes to task `end_date`, `estimated_cost`, and `status`. Add an "Activity" view accessible from the sidebar that displays a chronological feed of all project changes.

### 1. Database: Create `activity_log` table

New migration to create the table:

```sql
CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  task_id uuid,
  user_id uuid NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view activity logs"
  ON public.activity_log FOR SELECT
  USING (is_project_member(auth.uid(), project_id));

CREATE POLICY "Editors can insert activity logs"
  ON public.activity_log FOR INSERT
  WITH CHECK (is_project_editor(auth.uid(), project_id));

CREATE INDEX idx_activity_log_project ON public.activity_log(project_id, created_at DESC);
```

No delete/update policies needed -- audit logs should be append-only.

### 2. Frontend: Log changes in `useProjectData.ts`

In the `updateTask` function, after the DB update succeeds, compare old vs new values for the three tracked fields and insert activity log entries:

- **end_date**: "moved Deadline from {old} to {new}" on task "{title}"
- **estimated_cost**: "changed Estimated Cost from ${old} to ${new}" on task "{title}"  
- **status**: "changed Status from '{old}' to '{new}'" on task "{title}"

The description will include the user's display name (from AuthContext profile) for readability, e.g., "Sarah moved Deadline from Oct 1 to Oct 5".

### 3. Sidebar: Add "Activity" nav item

- Add `'activity'` to the `ViewType` union in `ProjectContext.tsx`
- Add a new nav item in `Sidebar.tsx` using the `Activity` (or `Clock`) icon from lucide-react
- Position it after "Risk Registry" and before "Settings"

### 4. New Component: `ProjectActivity.tsx`

A scrollable feed component that:
- Fetches from `activity_log` where `project_id` matches, ordered by `created_at DESC`
- Displays each entry as a card/row with: user avatar (from profiles join), timestamp (relative, e.g. "2 hours ago"), and description text
- Loads the most recent 50 entries initially with a "Load more" button
- Subscribes to realtime updates on the `activity_log` table for live feed

### 5. Wire up in `Index.tsx`

Add the `{activeView === 'activity' && <ProjectActivity />}` rendering branch.

---

### Technical Details

**Files to modify:**
- New migration SQL (activity_log table + RLS + index)
- `src/hooks/useProjectData.ts` -- add activity logging in `updateTask`
- `src/context/ProjectContext.tsx` -- add `'activity'` to `ViewType`
- `src/components/Sidebar.tsx` -- add Activity nav item
- `src/components/ProjectActivity.tsx` -- new component
- `src/pages/Index.tsx` -- render ProjectActivity for activity view

**Realtime:** Enable realtime on `activity_log` table so the feed updates live when teammates make changes.

**No breaking changes** to existing functionality -- this is purely additive.
