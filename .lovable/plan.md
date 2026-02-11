

## Add Project Settings View

Currently there is no way to edit project-level settings like the contingency percentage, project name, or manage members. This plan adds a "Settings" view accessible from the sidebar.

### What You Will Get

A new **Settings** tab in the sidebar (using the existing gear icon) that opens a settings panel where you can:

- **Rename the project**
- **Edit the contingency percentage** (the value currently shown as read-only in the sidebar)
- **Delete the project** (with confirmation)

### Changes

**1. Add "settings" as a view option**

- `src/context/ProjectContext.tsx` -- Expand `ViewType` to include `'settings'`
- `src/components/Sidebar.tsx` -- Add a Settings entry to the `navItems` array so it appears in the sidebar navigation alongside Table View, Timeline, and Risk Registry. Remove the static contingency display at the bottom (since it will be editable in settings).

**2. Create `src/components/ProjectSettings.tsx`**

A new component with a form containing:
- **Project Name** -- text input, pre-filled with current name
- **Contingency %** -- number input (0-100), pre-filled with current value
- **Save** button that calls existing `updateContingency` and a new `updateProjectName` function
- **Delete Project** section with a confirmation dialog that deletes the project and navigates back to the projects list

**3. Add `updateProjectName` to the data layer**

- `src/hooks/useProjectData.ts` -- Add an `updateProjectName` function that updates the project name in the database
- `src/context/ProjectContext.tsx` -- Expose `updateProjectName` through the context, and add `deleteProject` as well

**4. Wire the new view into Index.tsx**

- `src/pages/Index.tsx` -- Render `<ProjectSettings />` when `activeView === 'settings'`

### Technical Details

| File | Change |
|------|--------|
| `src/types/project.ts` | No changes needed |
| `src/context/ProjectContext.tsx` | Add `'settings'` to `ViewType`, expose `updateProjectName` and `deleteProject` |
| `src/hooks/useProjectData.ts` | Add `updateProjectName` and `deleteProject` functions |
| `src/components/Sidebar.tsx` | Add Settings nav item, remove static contingency section |
| `src/components/ProjectSettings.tsx` | New file -- settings form with name, contingency, and delete |
| `src/pages/Index.tsx` | Render `ProjectSettings` for settings view |

