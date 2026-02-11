export interface ColumnDef {
  id: string;
  label: string;
  width: string;
  align?: 'left' | 'right';
  locked?: boolean; // can't be hidden
}

export const ALL_COLUMNS: ColumnDef[] = [
  { id: 'drag', label: '', width: '24px', locked: true },
  { id: 'task', label: 'Task', width: 'minmax(200px,1fr)', locked: true },
  { id: 'status', label: 'Status', width: '140px' },
  { id: 'priority', label: 'Priority', width: '100px' },
  { id: 'owner', label: 'Owner', width: '100px' },
  { id: 'responsible', label: 'Responsible', width: '120px' },
  { id: 'start', label: 'Start', width: '110px' },
  { id: 'end', label: 'End', width: '110px' },
  { id: 'estCost', label: 'Est. Cost', width: '110px', align: 'right' },
  { id: 'actual', label: 'Actual', width: '110px', align: 'right' },
  { id: 'slippage', label: 'Slippage', width: '90px', align: 'right' },
  { id: 'checklist', label: 'Checklist', width: '80px' },
  { id: 'actions', label: '', width: '50px', locked: true },
];

const STORAGE_KEY = 'table-visible-columns';

export function getDefaultVisibleIds(): string[] {
  return ALL_COLUMNS.map(c => c.id);
}

export function loadVisibleColumns(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as string[];
      // Ensure locked columns are always included
      const locked = ALL_COLUMNS.filter(c => c.locked).map(c => c.id);
      const result = [...new Set([...locked, ...parsed.filter(id => ALL_COLUMNS.some(c => c.id === id))])];
      return result;
    }
  } catch {}
  return getDefaultVisibleIds();
}

export function saveVisibleColumns(ids: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export function buildGridTemplate(visibleIds: string[]): string {
  return ALL_COLUMNS
    .filter(c => visibleIds.includes(c.id))
    .map(c => c.width)
    .join(' ');
}

export function getVisibleColumns(visibleIds: string[]): ColumnDef[] {
  return ALL_COLUMNS.filter(c => visibleIds.includes(c.id));
}

/** Parse a column width like '140px' or 'minmax(200px,1fr)' into its pixel value */
function parsePixelWidth(width: string): number {
  const minmax = width.match(/minmax\((\d+)px/);
  if (minmax) return parseInt(minmax[1], 10);
  const px = width.match(/^(\d+)px$/);
  if (px) return parseInt(px[1], 10);
  return 0;
}

/** Calculate the minimum width needed for visible columns (plus padding buffer) */
export function calcMinWidth(visibleIds: string[]): string {
  const total = ALL_COLUMNS
    .filter(c => visibleIds.includes(c.id))
    .reduce((sum, c) => sum + parsePixelWidth(c.width), 0);
  return `${total + 32}px`;
}
