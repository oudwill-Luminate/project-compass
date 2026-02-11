

## Add "Back to Projects" Navigation

The sidebar currently has no way to return to the projects list. I'll add a back button/link at the top of the sidebar.

### Changes

**File: `src/components/Sidebar.tsx`**
- Add a "Back to Projects" link above the project name header, using `useNavigate` from react-router-dom
- It will be a small clickable row with a left arrow icon and "All Projects" text, navigating to `/`

This is a minimal, single-file change that follows the existing sidebar styling patterns.

