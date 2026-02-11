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
