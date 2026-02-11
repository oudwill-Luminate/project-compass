import { useState } from 'react';
import { format, parseISO, addDays } from 'date-fns';
import { AlertTriangle, MoreHorizontal, Link, GripVertical, Trash2, ChevronRight, ChevronDown, Plus, Shield } from 'lucide-react';
import { Task, STATUS_CONFIG, PRIORITY_CONFIG, TaskStatus, TaskPriority } from '@/types/project';
import { useProject } from '@/context/ProjectContext';
import { OwnerAvatar } from './OwnerAvatar';
import { TaskDialog } from './TaskDialog';
import { cn } from '@/lib/utils';
import type { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/** Compute rolled-up values for a parent task with sub-tasks */
function getRolledUp(task: Task) {
  if (task.subTasks.length === 0) {
    return {
      status: task.status,
      startDate: task.startDate,
      endDate: task.endDate,
      estimatedCost: task.estimatedCost,
      actualCost: task.actualCost,
    };
  }

  const subs = task.subTasks;
  const estimatedCost = subs.reduce((s, t) => s + t.estimatedCost, 0);
  const actualCost = subs.reduce((s, t) => s + t.actualCost, 0);

  const effectiveDates = subs.map(t => {
    const s = t.bufferDays > 0 && t.bufferPosition === 'start'
      ? format(addDays(parseISO(t.startDate), -t.bufferDays), 'yyyy-MM-dd')
      : t.startDate;
    const e = t.bufferDays > 0 && t.bufferPosition === 'end'
      ? format(addDays(parseISO(t.endDate), t.bufferDays), 'yyyy-MM-dd')
      : t.endDate;
    return { s, e };
  });
  const startDate = effectiveDates.reduce((min, d) => d.s < min ? d.s : min, effectiveDates[0].s);
  const endDate = effectiveDates.reduce((max, d) => d.e > max ? d.e : max, effectiveDates[0].e);

  let status: TaskStatus = 'not-started';
  if (subs.every(t => t.status === 'done')) status = 'done';
  else if (subs.some(t => t.status === 'stuck')) status = 'stuck';
  else if (subs.some(t => t.status === 'working' || t.status === 'done')) status = 'working';

  return { status, startDate, endDate, estimatedCost, actualCost };
}

interface TaskRowProps {
  task: Task;
  bucketId: string;
  bucketColor: string;
  depth?: number;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  gridCols: string;
  visibleColumnIds: string[];
}

export function TaskRow({ task, bucketId, bucketColor, depth = 0, dragHandleProps, gridCols: gridColsProp, visibleColumnIds: visibleColsProp }: TaskRowProps) {
  const { updateTask, deleteTask, getTaskById, addTask } = useProject();
  const defaultColIds = ['drag','task','status','priority','owner','responsible','start','end','estCost','actual','actions'];
  const visibleColumnIds = visibleColsProp ?? defaultColIds;
  const gridCols = gridColsProp ?? '24px minmax(200px,1fr) 140px 100px 100px 120px 110px 110px 110px 110px 50px';
  const [editOpen, setEditOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [addingSubTask, setAddingSubTask] = useState(false);
  const [subTaskTitle, setSubTaskTitle] = useState('');

  const hasSubTasks = task.subTasks.length > 0;
  const rolled = getRolledUp(task);

  const statusConfig = STATUS_CONFIG[rolled.status];
  const priorityConfig = PRIORITY_CONFIG[task.priority];
  const dependsOnTask = task.dependsOn ? getTaskById(task.dependsOn) : null;

  const show = (id: string) => (visibleColumnIds ?? []).includes(id);

  const cycleStatus = () => {
    if (hasSubTasks) return;
    const statuses: TaskStatus[] = ['not-started', 'working', 'stuck', 'done'];
    const currentIndex = statuses.indexOf(task.status);
    const nextStatus = statuses[(currentIndex + 1) % statuses.length];
    updateTask(task.id, { status: nextStatus });
  };

  const cyclePriority = () => {
    const priorities: TaskPriority[] = ['low', 'medium', 'high', 'critical'];
    const currentIndex = priorities.indexOf(task.priority);
    const nextPriority = priorities[(currentIndex + 1) % priorities.length];
    updateTask(task.id, { priority: nextPriority });
  };

  const handleAddSubTask = () => {
    if (subTaskTitle.trim()) {
      addTask(bucketId, subTaskTitle.trim(), task.id);
      setSubTaskTitle('');
      setAddingSubTask(false);
      setExpanded(true);
    }
  };

  const indent = depth * 28;

  // Build cells in column order
  const cells: React.ReactNode[] = [];

  if (show('drag')) {
    cells.push(
      <div key="drag" className="flex items-center gap-0.5">
        {dragHandleProps && depth === 0 ? (
          <div {...dragHandleProps} className="flex items-center cursor-grab active:cursor-grabbing">
            <GripVertical className="w-3.5 h-3.5 text-muted-foreground/50" />
          </div>
        ) : (
          <div className="w-3.5" />
        )}
      </div>
    );
  }

  if (show('task')) {
    cells.push(
      <div key="task" className="flex items-center gap-2 min-w-0">
        {hasSubTasks && (
          <button onClick={() => setExpanded(!expanded)} className="shrink-0 p-0.5 hover:bg-muted rounded">
            {expanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </button>
        )}
        <button
          onClick={() => setEditOpen(true)}
          className="font-medium text-foreground truncate hover:text-primary hover:underline transition-colors text-left"
        >
          {task.title}
        </button>
        {hasSubTasks && (
          <span className="text-[10px] text-muted-foreground shrink-0">
            ({task.subTasks.length})
          </span>
        )}
        {task.dependsOn && (
          <span className="text-muted-foreground shrink-0" title={`Depends on: ${dependsOnTask?.title || task.dependsOn}`}>
            <Link className="w-3 h-3" />
          </span>
        )}
        {task.flaggedAsRisk && (
          <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
        )}
      </div>
    );
  }

  if (show('status')) {
    cells.push(
      <button
        key="status"
        onClick={cycleStatus}
        className={cn(
          "text-xs font-medium px-3 py-1.5 rounded-full text-white text-center transition-transform hover:scale-105 truncate",
          hasSubTasks ? "cursor-default opacity-80" : "cursor-pointer"
        )}
        style={{ backgroundColor: `hsl(var(--${statusConfig.colorVar}))` }}
        disabled={hasSubTasks}
      >
        {statusConfig.label}
      </button>
    );
  }

  if (show('priority')) {
    cells.push(
      <button
        key="priority"
        onClick={cyclePriority}
        className="text-xs font-medium px-2 py-1 rounded text-center cursor-pointer transition-transform hover:scale-105"
        style={{
          backgroundColor: `hsl(var(--${priorityConfig.colorVar}) / 0.12)`,
          color: `hsl(var(--${priorityConfig.colorVar}))`,
        }}
      >
        {priorityConfig.label}
      </button>
    );
  }

  if (show('owner')) {
    cells.push(
      <div key="owner" className="flex items-center gap-1.5">
        <OwnerAvatar owner={task.owner} />
      </div>
    );
  }

  if (show('responsible')) {
    cells.push(
      <span key="responsible" className="text-muted-foreground text-xs truncate" title={task.responsible || ''}>
        {task.responsible || '—'}
      </span>
    );
  }

  if (show('start')) {
    cells.push(
      <span key="start" className="text-muted-foreground text-xs flex items-center gap-1">
        {format(parseISO(rolled.startDate), 'MMM dd')}
        {task.bufferDays > 0 && task.bufferPosition === 'start' && (
          <span title={`${task.bufferDays}d buffer (start)`}><Shield className="w-3 h-3 text-primary" /></span>
        )}
      </span>
    );
  }

  if (show('end')) {
    cells.push(
      <span key="end" className="text-muted-foreground text-xs flex items-center gap-1">
        {format(parseISO(rolled.endDate), 'MMM dd')}
        {task.bufferDays > 0 && task.bufferPosition === 'end' && (
          <span title={`${task.bufferDays}d buffer (end)`}><Shield className="w-3 h-3 text-primary" /></span>
        )}
      </span>
    );
  }

  if (show('estCost')) {
    cells.push(
      <span key="estCost" className="text-right font-medium tabular-nums">
        ${rolled.estimatedCost.toLocaleString()}
      </span>
    );
  }

  if (show('actual')) {
    cells.push(
      <span key="actual" className={cn('text-right font-medium tabular-nums', rolled.actualCost > rolled.estimatedCost && 'text-destructive')}>
        ${rolled.actualCost.toLocaleString()}
      </span>
    );
  }

  if (show('actions')) {
    cells.push(
      <div key="actions" className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1.5 rounded-md hover:bg-muted transition-colors">
              <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover">
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              Edit Task
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setAddingSubTask(true); setExpanded(true); }}>
              <Plus className="w-3.5 h-3.5 mr-2" />
              Add Sub-task
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                if (task.flaggedAsRisk) {
                  updateTask(task.id, { flaggedAsRisk: false, riskImpact: 1, riskProbability: 1 });
                } else {
                  updateTask(task.id, { flaggedAsRisk: true, riskImpact: 3, riskProbability: 3 });
                }
              }}
            >
              {task.flaggedAsRisk ? 'Remove Risk Flag' : 'Flag as Risk'}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => { if (confirm(`Delete "${task.title}"?`)) deleteTask(task.id); }}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="w-3.5 h-3.5 mr-2" />
              Delete Task
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          "grid gap-0 px-4 py-2.5 border-t hover:bg-muted/40 transition-colors items-center text-sm",
          hasSubTasks && "font-medium bg-muted/10"
        )}
        style={{ gridTemplateColumns: gridCols, borderLeft: `4px solid ${bucketColor}15`, paddingLeft: `${16 + indent}px`, minWidth: '900px' }}
      >
        {cells}
      </div>

      {/* Sub-tasks */}
      {expanded && hasSubTasks && task.subTasks.map(sub => (
        <TaskRow
          key={sub.id}
          task={sub}
          bucketId={bucketId}
          bucketColor={bucketColor}
          depth={depth + 1}
          gridCols={gridCols}
          visibleColumnIds={visibleColumnIds}
        />
      ))}

      {/* Inline add sub-task */}
      {expanded && addingSubTask && (
        <div
          className="flex items-center gap-2 px-4 py-1.5 border-t"
          style={{ paddingLeft: `${16 + (depth + 1) * 28}px`, borderLeft: `4px solid ${bucketColor}15` }}
        >
          <input
            autoFocus
            value={subTaskTitle}
            onChange={e => setSubTaskTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAddSubTask();
              if (e.key === 'Escape') { setAddingSubTask(false); setSubTaskTitle(''); }
            }}
            onBlur={() => { if (subTaskTitle.trim()) handleAddSubTask(); else { setAddingSubTask(false); setSubTaskTitle(''); } }}
            placeholder="Sub-task name…"
            className="bg-transparent border-b border-primary/40 text-sm px-1 py-0.5 outline-none text-foreground placeholder:text-muted-foreground w-64"
          />
        </div>
      )}

      <TaskDialog task={task} open={editOpen} onOpenChange={setEditOpen} />
    </>
  );
}
