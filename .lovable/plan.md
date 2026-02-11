

## Circular Dependency Detection and CMD+K Task Search

### Overview
Two improvements to project scheduling UX:
1. **Circular dependency detection** -- When selecting a "Depends On" task in the TaskDialog, immediately check if it would create a loop (A depends on B depends on A). If so, show a destructive toast and revert the selection.
2. **CMD+K / CTRL+K search** -- A global keyboard shortcut that opens a command palette to quickly search and jump to any task by name, opening its TaskDialog.

---

### 1. Circular Dependency Detection (TaskDialog.tsx)

**What changes:**
- Add a `detectCircularDependency` helper function that walks the dependency chain from the selected predecessor. If it ever reaches back to the current task, a cycle exists.
- Wrap the "Depends On" `onValueChange` handler to call this check before updating state. If circular, show an error toast and keep the previous value.

**Logic:**
```text
function hasCircularDependency(taskId, proposedDependsOn, allTasks):
    visited = { taskId }
    current = proposedDependsOn
    while current exists:
        if current in visited -> return true (circular!)
        visited.add(current)
        current = allTasks.find(t => t.id === current).dependsOn
    return false
```

**File:** `src/components/TaskDialog.tsx`
- Replace the `onValueChange` of the "Depends On" Select (around line 341) to run the circular check first, showing a destructive toast on failure.

---

### 2. CMD+K Task Search (New Component + Index Integration)

**New file:** `src/components/TaskSearchCommand.tsx`
- Uses the existing `cmdk`-based `CommandDialog`, `CommandInput`, `CommandList`, `CommandItem`, `CommandEmpty` components from `src/components/ui/command.tsx`.
- Lists all tasks (from `useProject().getAllTasks()`) filtered by the search query.
- Selecting a task opens its `TaskDialog` for editing.

**Global keyboard listener:**
- In `src/pages/Index.tsx`, add a `useEffect` that listens for `CMD+K` (Mac) / `CTRL+K` (Windows) and toggles the search dialog open.

**Files changed:**
- `src/components/TaskSearchCommand.tsx` (new) -- Command palette component
- `src/pages/Index.tsx` -- Add keyboard listener and render the search component

---

### Technical Details

**Circular detection in TaskDialog.tsx:**
- The helper uses `getAllTasks()` already available in the component.
- Walks the `dependsOn` chain with a visited set to detect cycles in O(n) time.
- On detection: `toast({ title: 'Error: Circular Dependency', description: '...', variant: 'destructive' })` and the Select value stays unchanged.

**TaskSearchCommand.tsx:**
- Accepts `open` / `onOpenChange` props and an `onSelectTask(task: Task)` callback.
- Groups tasks or shows them flat with status/owner badges for quick identification.
- The selected task opens a TaskDialog inline.

**Index.tsx integration:**
- `useEffect` with `keydown` listener for `(e.metaKey || e.ctrlKey) && e.key === 'k'` -- calls `e.preventDefault()` and toggles state.
- Renders `<TaskSearchCommand>` at the page level so it works across all views.

