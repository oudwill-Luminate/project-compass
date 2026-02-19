

## Timeline Zoom Controls

### Overview
Add zoom in/out controls to the Timeline view so you can adjust how much of the project timeline is visible at once. Currently the timeline auto-fits all tasks with 1-week padding on each side and uses a fixed `min-width: 1200px`. Zoom will work by scaling that minimum width -- zooming in stretches the timeline wider (more detail per day), zooming out compresses it (more days visible).

### How It Works

- A `zoomLevel` state (default 1.0) controls the horizontal scale
- Zoom in: increases `zoomLevel` (e.g. 1.5x, 2x) making each day wider
- Zoom out: decreases `zoomLevel` (e.g. 0.75x, 0.5x) compressing days
- The `min-width` of the inner timeline container scales with `zoomLevel` (e.g. at 2x zoom, min-width becomes 2400px)
- All percentage-based positioning (task bars, grid lines, today marker) continues to work unchanged since they're relative to the container width
- A "Reset" button returns to 1.0x

### UI

Zoom controls will be added to the header area (next to the legend), as a small button group:

```
[ - ]  100%  [ + ]  [Reset]
```

- Minus button: zoom out (step down by 0.25, min 0.25)
- Plus button: zoom in (step up by 0.25, max 4.0)
- Percentage label shows current zoom
- Reset button returns to 1.0

Optionally, Ctrl+Scroll (mouse wheel) on the timeline area can also adjust zoom for a more natural interaction.

### Technical Details

**File: `src/components/TimelineView.tsx`**

1. Add state: `const [zoomLevel, setZoomLevel] = useState(1)`

2. Add zoom handler functions:
   - `zoomIn`: `setZoomLevel(prev => Math.min(prev + 0.25, 4))`
   - `zoomOut`: `setZoomLevel(prev => Math.max(prev - 0.25, 0.25))`
   - `resetZoom`: `setZoomLevel(1)`

3. Add `onWheel` handler to the scrollable container for Ctrl+Scroll zoom

4. Update the inner container's `min-width` from the hardcoded `1200px` to `${1200 * zoomLevel}px`

5. Add the zoom control buttons in the header between the title and legend sections, using the existing Button component from `@/components/ui/button` and `ZoomIn`, `ZoomOut`, `RotateCcw` icons from `lucide-react`

### Files Changed
- `src/components/TimelineView.tsx`: Add zoom state, controls UI, wheel handler, and dynamic min-width
