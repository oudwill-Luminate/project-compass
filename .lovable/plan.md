

## Add Rich Bucket/Group Details

Currently, buckets only store a name and color. This plan adds a **description** field and an **owner** field to buckets, along with a proper edit dialog to manage all bucket properties.

### Database Changes

**Migration: Add columns to `buckets` table**
- `description TEXT DEFAULT ''` -- free-text notes about the group's purpose/scope
- `owner_id UUID DEFAULT NULL` -- references a project member who leads this group

### UI Changes

**1. Bucket Edit Dialog (`src/components/BucketDialog.tsx` -- new file)**
- A dialog/sheet with fields for:
  - Name (text input)
  - Color (color picker or preset swatches)
  - Description (textarea)
  - Owner/Lead (dropdown of project members)
- Opens when clicking "Edit Group" from the bucket's dropdown menu (replacing the inline rename)

**2. Bucket Header Updates (`src/components/TableView.tsx`)**
- Show owner avatar next to bucket name in the header row
- Show truncated description as a subtitle below the bucket name (if set)
- Add "Edit Group" option in the dropdown menu that opens the new dialog
- Keep the existing "Rename Group" as a quick inline option

### Data Layer Changes

**3. Type Updates (`src/types/project.ts`)**
- Add `description?: string` and `ownerId?: string | null` to the `Bucket` interface

**4. Hook Updates (`src/hooks/useProjectData.ts`)**
- Read `description` and `owner_id` from bucket rows
- Map `owner_id` to an `Owner` object using the existing profile map
- Update `updateBucket` to accept `description` and `owner_id` fields
- Update `addBucket` to accept optional description/owner

**5. Context Updates (`src/context/ProjectContext.tsx`)**
- Expand the `updateBucket` signature to include the new fields

### Summary of Files Changed
| File | Action |
|------|--------|
| `supabase/migrations/` | New migration adding `description` and `owner_id` columns |
| `src/types/project.ts` | Add fields to `Bucket` interface |
| `src/hooks/useProjectData.ts` | Read/write new bucket fields |
| `src/context/ProjectContext.tsx` | Update `updateBucket` type signature |
| `src/components/BucketDialog.tsx` | New edit dialog component |
| `src/components/TableView.tsx` | Wire up dialog, show description/owner in header |

