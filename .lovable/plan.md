

## Add Bucket and Task Creation

Currently the app can display and edit tasks/buckets but has no way to create them. This plan adds "Add Bucket" and "Add Task" functionality.

### What you'll get

- An **"+ Add Group"** button below the last bucket in the table view to create new work breakdown groups
- An **"+ Add Task"** button at the bottom of each bucket to add tasks within that group
- Both will insert directly into the database and auto-refresh via the existing realtime subscription

### Technical Details

**1. `src/hooks/useProjectData.ts`** -- Add two new functions:

- `addBucket(name: string)`: Inserts a new row into the `buckets` table with the project ID, name, a default color, and a position based on existing bucket count
- `addTask(bucketId: string, title: string)`: Inserts a new row into the `tasks` table with the bucket ID, title, and sensible defaults (status: not-started, priority: medium, owner set to current user, dates defaulting to today + 7 days)
- Return both from the hook

**2. `src/context/ProjectContext.tsx`** -- Expose the new functions:

- Add `addBucket` and `addTask` to the context type and provider value
- Wire them through from the hook

**3. `src/components/TableView.tsx`** -- Add creation UI:

- After the last bucket, add an **"+ Add Group"** button with an inline text input (click to reveal input, Enter to submit, Escape to cancel)
- Inside each bucket (after the task rows, before the subtotal footer), add an **"+ Add Task"** button with similar inline input behavior
- Style these subtly to match the existing design -- muted text, small font, hover highlight

**4. No database changes needed** -- The existing `buckets` and `tasks` tables along with their RLS policies (editors can create) already support inserts for authenticated project editors.

