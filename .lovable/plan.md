

## Make All Changes Instant with Optimistic Updates

Right now, every change (renaming a bucket, adding a task, updating a task, deleting, moving) writes to the database and then waits for the realtime subscription to trigger a full re-fetch of all data. This round-trip causes a noticeable delay.

The fix is **optimistic updates** -- update the local state immediately so the UI reflects changes instantly, then persist to the database in the background.

### Changes

**`src/hooks/useProjectData.ts`** -- Add optimistic local state updates to every mutation:

- **`updateBucket`**: Immediately update the bucket's name/color in the local `project` state, then persist to DB
- **`addBucket`**: Generate a temporary ID, add the bucket to local state instantly, then insert into DB and replace the temp ID on the realtime refresh
- **`deleteBucket`**: Remove the bucket from local state immediately, then delete from DB
- **`addTask`**: Add a new task with defaults to the local bucket state instantly, then insert into DB
- **`deleteTask`**: Remove the task from local state immediately, then delete from DB
- **`moveTask`**: Move the task between buckets in local state immediately, then update DB
- **`updateTask`**: Apply all field changes to the local task state immediately before writing to DB
- **`updateContingency`**: Update local project contingency immediately

Each function will call `setProject()` with the optimistically updated state before making the async database call. The realtime subscription will still fire and reconcile, but the user sees the change instantly.

### Technical approach

```text
User Action
    |
    v
Update local state (setProject)  <-- instant UI update
    |
    v
Write to Supabase (async)        <-- background persistence
    |
    v
Realtime subscription fires      <-- reconciles with server truth
```

No new files or dependencies needed. All changes are within `useProjectData.ts`.

