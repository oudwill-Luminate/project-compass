

## Add Date Range Picker to Timeline View

### Overview
Add two date pickers ("From" and "To") next to the existing zoom controls, allowing you to define the exact time window the timeline displays. When dates are selected, the timeline will only show that range instead of auto-fitting to all task dates. A "Reset" option will return to the default auto-fit behavior.

### How It Works

- Two new state variables: `rangeStart` and `rangeEnd` (both `Date | undefined`)
- When both are set, the timeline computation uses those dates instead of deriving min/max from task dates
- When either is unset, the timeline falls back to the current auto-fit behavior (earliest task minus 1 week to latest task plus 1 week)
- Tasks that fall partially outside the selected range will still render (their bars will extend beyond the visible area, clipped by the scroll container)

### UI Layout

The date pickers will be placed in the header row, between the zoom controls and the legend:

```text
Timeline                [From: _date_] [To: _date_] [x]   [-] 100% [+] [Reset]   Legend...
```

- Each date picker uses the existing Popover + Calendar (Shadcn DatePicker pattern)
- A small "x" clear button resets both dates back to auto-fit
- Calendar gets `pointer-events-auto` class for proper interaction inside popovers

### Technical Details

**File: `src/components/TimelineView.tsx`**

1. Add imports: `Calendar` from `@/components/ui/calendar`, `Popover`/`PopoverTrigger`/`PopoverContent` from `@/components/ui/popover`, `CalendarIcon` from `lucide-react`, `cn` from `@/lib/utils`

2. Add state:
   ```
   const [rangeStart, setRangeStart] = useState<Date | undefined>()
   const [rangeEnd, setRangeEnd] = useState<Date | undefined>()
   ```

3. Update the `timelineStart/totalDays/weeks` useMemo (lines 303-319) to use `rangeStart`/`rangeEnd` when set:
   - If both are defined, use them as `minDate`/`maxDate` instead of computing from task dates
   - Still apply the 1-week padding on each side
   - If only one is set, use the set value for that bound and compute the other from tasks

4. Add the date picker UI in the header area (around line 337), using two Popover+Calendar combos styled compactly, plus a clear button

### Files Changed
- `src/components/TimelineView.tsx`: Add date range state, two date picker controls, and conditional timeline range computation
