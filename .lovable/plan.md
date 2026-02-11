

## Enhanced Project Overview Tab

### Overview
Upgrade the existing Project Overview page with a Markdown editor (write + preview toggle) for the Project Charter, and add a "Project Health" traffic-light widget showing Schedule, Budget, and Risk status derived from live project data.

---

### 1. Markdown Editor with Preview (no new dependencies)

Rather than adding a heavy rich-text library like Tiptap, use a lightweight **write/preview toggle** approach that works with the existing Markdown stored in `charter_markdown`:

- **Write mode**: Keep the current `Textarea` (mono font) for editing raw Markdown
- **Preview mode**: Render the Markdown as formatted HTML using a small custom parser (handles headings, bold, italic, lists, line breaks) -- no external library needed
- A `Tabs` component (already available via Radix) switches between "Write" and "Preview"

This avoids adding a dependency while giving a much better authoring experience than the current raw textarea.

---

### 2. Project Health Widget

A card with three traffic-light indicators for **Schedule**, **Budget**, and **Risk**, each showing a colored dot (green/yellow/red) with a short label.

**Schedule Health** (derived from task data):
- **Green**: >= 80% of tasks are on-time (end date on or before baseline, or no baseline set and status is done/working)
- **Yellow**: 50-79% on-time
- **Red**: < 50% on-time, or any critical-path task is "stuck"

**Budget Health** (derived from cost data):
- **Green**: Total actual cost <= 90% of total estimated cost
- **Yellow**: 90-100% of estimated
- **Red**: Over budget (actual > estimated)

**Risk Health** (derived from risk-flagged tasks):
- **Green**: No high-impact risks (impact * probability < 12)
- **Yellow**: Some moderate risks (any task with score 9-15)
- **Red**: Any task with risk score >= 16 (impact * probability), or more than 3 flagged risks

---

### 3. Layout Restructure

The page will be reorganized into sections:

```text
+------------------------------------------+
|  Project Overview header                 |
+------------------------------------------+
|  [ Project Health Widget ]               |
|  Schedule: (G)  Budget: (G)  Risk: (Y)   |
+------------------------------------------+
|  Project Charter                         |
|  [Write] [Preview]                       |
|  +------------------------------------+  |
|  |  Markdown editor / rendered view   |  |
|  +------------------------------------+  |
|  [Save Charter]                          |
+------------------------------------------+
|  Project Goals (unchanged)               |
+------------------------------------------+
```

---

### 4. Files to Change

| File | Action |
|------|--------|
| `src/components/ProjectOverview.tsx` | Major rewrite: add health widget, add Markdown preview tabs |
| `src/lib/projectHealth.ts` | New file: pure utility functions to compute schedule/budget/risk health status |

No new dependencies required -- uses existing `Tabs` component from Radix and the `computeCriticalPath` utility.

---

### 5. Technical Details

**Health computation (`src/lib/projectHealth.ts`)**:

```text
type HealthStatus = 'green' | 'yellow' | 'red';

function computeScheduleHealth(tasks, criticalTaskIds) -> HealthStatus
function computeBudgetHealth(tasks, contingencyPercent) -> HealthStatus  
function computeRiskHealth(tasks) -> HealthStatus
```

Each function is pure and takes the flattened task list as input, returning a simple status string.

**Markdown preview**: A simple function that converts basic Markdown syntax (headings, bold, italic, lists, paragraphs) into React elements. This covers the typical charter content without needing a full Markdown library.

**Traffic light rendering**: Each indicator is a flex row with a colored circle (`w-3 h-3 rounded-full`) and label text. Colors map to Tailwind classes: `bg-green-500`, `bg-yellow-500`, `bg-red-500`.

