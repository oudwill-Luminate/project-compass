

## Monday-Style Polish for TableView

### Overview

Add visual polish inspired by Monday.com: hover glow effects on task rows with reveal-on-hover drag handles, and smooth framer-motion layout animations for bucket expand/collapse.

---

### 1. Task Row Hover Glow and Drag Handle Reveal

**File: `src/components/TaskRow.tsx`**

- Add a CSS `group` class to the row container div so child elements can respond to hover state
- Hide the drag handle by default using `opacity-0` and reveal it on row hover with `group-hover:opacity-100` plus a smooth transition
- Replace the plain `hover:bg-muted/40` with a more polished glow effect using a subtle box-shadow or a gradient background on hover:
  - Add `transition-all duration-200` for smoothness
  - On hover: apply a soft left-edge glow using the bucket color and a light background highlight

**Changes to the row div (line ~309-314):**
```tsx
<div
  className={cn(
    "group grid gap-0 px-4 py-2.5 border-t transition-all duration-200 items-center text-sm",
    "hover:bg-primary/[0.03] hover:shadow-[inset_3px_0_0_0_var(--glow-color)]",
    hasSubTasks && "font-medium bg-muted/10"
  )}
  style={{
    gridTemplateColumns: gridCols,
    borderLeft: `4px solid ${bucketColor}15`,
    paddingLeft: `${16 + indent}px`,
    '--glow-color': bucketColor,
  } as React.CSSProperties}
>
```

**Drag handle (line ~126-133):** Change from always-visible to hover-revealed:
```tsx
<div {...dragHandleProps} className="flex items-center cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity duration-200">
  <GripVertical className="w-3.5 h-3.5 text-muted-foreground/50" />
</div>
```

The placeholder `<div className="w-3.5" />` for non-draggable rows stays hidden.

---

### 2. Smooth Bucket Expand/Collapse with Framer Motion

**File: `src/components/TableView.tsx`**

The current implementation already uses `AnimatePresence` and `motion.div` with `height: 0 -> auto` for bucket collapse. The refinement will:

- Add `layout` prop to each `Draggable` wrapper so rows animate their position when siblings appear/disappear
- Adjust the existing `motion.div` animation to use a spring transition for a more natural feel instead of the current `easeInOut`:

```tsx
<motion.div
  initial={{ height: 0, opacity: 0 }}
  animate={{ height: 'auto', opacity: 1 }}
  exit={{ height: 0, opacity: 0 }}
  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
  className="overflow-hidden"
>
```

- Wrap each bucket's outer `div` (inside the `Draggable` render) with `motion.div` using `layout` transition so buckets below a collapsing bucket slide up smoothly:

```tsx
<motion.div
  layout
  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
  ref={bucketDragProvided.innerRef}
  {...bucketDragProvided.draggableProps}
  className={cn("rounded-xl border overflow-visible shadow-sm", ...)}
>
```

- Add `<LayoutGroup>` wrapper from framer-motion around the bucket list to coordinate layout animations across siblings.

---

### 3. Optional: Actions Column Hover Reveal

As a bonus Monday-style touch, the actions menu button (three dots) will also use `opacity-0 group-hover:opacity-100` so it only appears on hover, reducing visual clutter.

---

### Files Changed

| File | Change |
|------|--------|
| `src/components/TaskRow.tsx` | Add `group` class, hover glow, drag handle + actions reveal-on-hover |
| `src/components/TableView.tsx` | Add `layout` + spring transitions to bucket expand/collapse, wrap with `LayoutGroup` |

### Technical Notes

- `LayoutGroup` is imported from `framer-motion` (already installed)
- The `--glow-color` CSS variable technique avoids needing inline style overrides for the box-shadow
- Spring transitions (`stiffness: 400, damping: 30`) give a snappy but not bouncy feel similar to Monday.com
- No new dependencies needed

