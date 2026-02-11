

## Fix Table Width Rendering (Take 2)

### Root Cause
The bucket containers (`rounded-xl border overflow-hidden`) clip their children because of `overflow-hidden`. Even though the inner grid rows have the correct `minWidth`, the parent containers don't respect it. The horizontal scroll wrapper only works if ALL content inside it has consistent minimum widths.

### Solution
Apply `minWidth` to the scrollable wrapper's inner content so everything expands together, rather than trying to set it on individual rows.

### Changes

**`src/components/TableView.tsx`**
1. Wrap all content inside the `overflow-x-auto` div in a single inner div with `style={{ minWidth }}` -- this ensures the header, all bucket containers, and all rows expand to the same width together
2. Remove `minWidth` from the individual header div (line 153) and bucket footer div (line 301) since the parent wrapper handles it
3. Change bucket container from `overflow-hidden` to `overflow-visible` so content isn't clipped (keep `rounded-xl border shadow-sm`)

**`src/components/TaskRow.tsx`**
- Remove the per-row `minWidth: calcMinWidth(visibleColumnIds)` from the task row style (line 298) since the parent wrapper now handles it
- Remove the `calcMinWidth` import since it's no longer needed here

### Technical Details
- The key insight: `overflow-x-auto` on the scroll container only works when there's a single inner element wider than the container. Currently, each row independently sets its own `minWidth` but the parent bucket divs have `overflow-hidden` which clips them.
- By moving `minWidth` to one wrapper div inside the scroll container, everything scrolls together consistently.
- The bucket border rounding can be preserved with `overflow: visible` since the scroll container handles the clipping.
