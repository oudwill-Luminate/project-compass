
## Fix Table Width Rendering

### Problem
The table's `minWidth` is set to `900px`, but the actual column widths add up to approximately 1174px minimum. This causes columns on the right side (Actual cost, Actions) to be squished or cut off.

### Solution
Calculate the minimum width dynamically based on which columns are visible, so the table always has enough room for all active columns.

### Changes

**1. `src/components/tableColumns.ts`**
- Add a helper function `calcMinWidth(visibleIds)` that sums up the pixel widths of all visible columns (using fixed values; the flexible `task` column counts as its minimum 200px)
- This ensures the min-width adapts when columns are hidden/shown

**2. `src/components/TableView.tsx`**
- Replace the hardcoded `minWidth: '900px'` on the header and footer with the calculated min-width from the new helper
- Apply the same min-width consistently to both header and bucket footer rows

**3. `src/components/TaskRow.tsx`**
- Replace the hardcoded `minWidth: '900px'` on task rows with the same calculated min-width
- Pass the min-width value as a prop (or calculate from `visibleColumnIds`)

### Technical Details
- Column pixel values: drag=24, task=200(min), status=140, priority=100, owner=100, responsible=120, start=110, end=110, estCost=110, actual=110, actions=50
- The function parses widths from the column definitions, treating `minmax(Xpx,1fr)` as X
- Add ~32px padding buffer for the grid container padding
