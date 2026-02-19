import { useState, useEffect } from 'react';
import { format, parseISO, addDays, differenceInDays } from 'date-fns';
import { AlertTriangle, MoreHorizontal, Link, GripVertical, Trash2, ChevronRight, ChevronDown, Plus, Shield, CheckSquare, Diamond } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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
      progress: task.progress,
    };
  }

  const subs = task.subTasks;
  const subEstimated = subs.reduce((s, t) => s + t.estimatedCost, 0);
  const subActual = subs.reduce((s, t) => s + t.actualCost, 0);
  const estimatedCost = subEstimated > 0 ? subEstimated : task.estimatedCost;
  const actualCost = subActual > 0 ? subActual : task.actualCost;

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

  // Average progress for parent: done=100, not-started=0, others use their progress value
  const progress = Math.round(subs.reduce((sum, t) => {
    if (t.status === 'done') return sum + 100;
    if (t.status === 'not-started') return sum + 0;
    return sum + (t.progress || 0);
  }, 0) / subs.length);

  return { status, startDate, endDate, estimatedCost, actualCost, progress };
}

interface TaskRowProps {
  task: Task;
  bucketId: string;
  bucketColor: string;
  depth?: number;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  gridCols: string;
  visibleColumnIds: string[];
  slackDays?: Map<string, number>;
}

export function TaskRow({ task, bucketId, bucketColor, depth = 0, dragHandleProps, gridCols: gridColsProp, visibleColumnIds: visibleColsProp, slackDays }: TaskRowProps) {
  const { updateTask, deleteTask, getTaskById, addTask } = useProject();
  const defaultColIds = ['drag','task','status','priority','owner','responsible','start','end','estCost','actual','actions'];
  const visibleColumnIds = visibleColsProp ?? defaultColIds;
  const gridCols = gridColsProp ?? '24px minmax(200px,1fr) 140px 100px 100px 120px 110px 110px 110px 110px 50px';
  const [editOpen, setEditOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [addingSubTask, setAddingSubTask] = useState(false);
  const [subTaskTitle, setSubTaskTitle] = useState('');
  const [checklistCount, setChecklistCount] = useState<{ checked: number; total: number } | null>(null);

  useEffect(() => {
    supabase
      .from('checklist_items' as any)
      .select('checked')
      .eq('task_id', task.id)
      .then(({ data }) => {
        if (data && (data as any[]).length > 0) {
          const items = data as any[];
          setChecklistCount({ checked: items.filter((i: any) => i.checked).length, total: items.length });
        } else {
          setChecklistCount(null);
        }
      });
  }, [task.id, editOpen]);

  const hasSubTasks = task.subTasks.length > 0;
  const isHighRisk = task.flaggedAsRisk && task.riskImpact >= 4;
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
          <div {...dragHandleProps} className="flex items-center cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity duration-200">
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
        {task.isMilestone && (
          <Diamond className="w-3.5 h-3.5 text-primary shrink-0" fill="currentColor" />
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
        {task.flaggedAsRisk && !isHighRisk && (
          <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
        )}
        {isHighRisk && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-destructive-foreground bg-destructive px-1.5 py-0.5 rounded-full shrink-0 animate-pulse">
            <AlertTriangle className="w-3 h-3" />
            High Risk
          </span>
        )}
      </div>
    );
  }

  if (show('status')) {
    const isWorking = rolled.status === 'working';
    const prog = rolled.progress || 0;
    const statusBg = isWorking && prog > 0
      ? `linear-gradient(to right, hsl(var(--${statusConfig.colorVar})) ${prog}%, hsl(var(--${statusConfig.colorVar}) / 0.3) ${prog}%)`
      : `hsl(var(--${statusConfig.colorVar}))`;
    cells.push(
      <button
        key="status"
        onClick={cycleStatus}
        className={cn(
          "text-xs font-medium px-3 py-1.5 rounded-full text-white text-center transition-transform hover:scale-105 truncate",
          hasSubTasks ? "cursor-default opacity-80" : "cursor-pointer"
        )}
        style={{ background: statusBg }}
        disabled={hasSubTasks}
      >
        {isWorking && prog > 0 ? `Working ${prog}%` : statusConfig.label}
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
        {task.isMilestone && <Diamond className="w-3 h-3 text-primary" fill="currentColor" />}
        {!task.isMilestone && task.bufferDays > 0 && task.bufferPosition === 'start' && (
          <span title={`${task.bufferDays}d buffer (start)`}><Shield className="w-3 h-3 text-primary" /></span>
        )}
      </span>
    );
  }

  if (show('end')) {
    cells.push(
      task.isMilestone ? (
        <span key="end" className="text-muted-foreground text-xs">—</span>
      ) : (
        <span key="end" className="text-muted-foreground text-xs flex items-center gap-1">
          {format(parseISO(rolled.endDate), 'MMM dd')}
          {task.bufferDays > 0 && task.bufferPosition === 'end' && (
            <span title={`${task.bufferDays}d buffer (end)`}><Shield className="w-3 h-3 text-primary" /></span>
          )}
        </span>
      )
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
      <span key="actual" className={cn(
        'text-right font-medium tabular-nums',
        (rolled.actualCost + (task.realizedCost || 0)) > rolled.estimatedCost && 'text-destructive bg-destructive/10 px-2 py-0.5 rounded-md'
      )}>
        ${rolled.actualCost.toLocaleString()}
      </span>
    );
  }

  if (show('slack')) {
    const slack = slackDays?.get(task.id);
    const isCritical = slack !== undefined && slack === 0;
    cells.push(
      <span
        key="slack"
        className={cn(
          'text-right text-xs font-medium tabular-nums',
          isCritical && 'text-orange-600 font-bold',
          slack !== undefined && slack > 0 && slack <= 2 && 'text-amber-600',
          (slack === undefined || slack > 2) && 'text-muted-foreground'
        )}
        title={isCritical ? 'Critical path — zero slack' : `${slack ?? '—'} days of slack`}
      >
        {slack !== undefined ? `${slack}d` : '—'}
      </span>
    );
  }

  if (show('slippage')) {
    const hasBaseline = task.baselineEndDate && task.baselineStartDate;
    if (hasBaseline) {
      const slipDays = differenceInDays(parseISO(rolled.endDate), parseISO(task.baselineEndDate!));
      cells.push(
        <span
          key="slippage"
          className={cn(
            'text-right text-xs font-medium tabular-nums',
            slipDays > 0 && 'text-destructive',
            slipDays < 0 && 'text-[hsl(var(--status-done))]',
            slipDays === 0 && 'text-muted-foreground'
          )}
        >
          {slipDays > 0 ? `+${slipDays}d` : slipDays < 0 ? `${slipDays}d` : '0d'}
        </span>
      );
    } else {
      cells.push(
        <span key="slippage" className="text-right text-xs text-muted-foreground">—</span>
      );
    }
  }

  if (show('checklist')) {
    cells.push(
      checklistCount ? (
        <span
          key="checklist"
          className={cn(
            'inline-flex items-center gap-1 text-xs font-medium',
            checklistCount.checked === checklistCount.total ? 'text-[hsl(var(--status-done))]' : 'text-muted-foreground'
          )}
        >
          <CheckSquare className="w-3.5 h-3.5" />
          {checklistCount.checked}/{checklistCount.total}
        </span>
      ) : (
        <span key="checklist" className="text-xs text-muted-foreground">—</span>
      )
    );
  }

  if (show('actions')) {
    cells.push(
      <div key="actions" className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1.5 rounded-md hover:bg-muted transition-colors opacity-0 group-hover:opacity-100 transition-opacity duration-200">
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
            {!hasSubTasks && (
              <DropdownMenuItem
                onClick={() => {
                  const newVal = !task.isMilestone;
                  const milestoneUpdates: Partial<Task> = { isMilestone: newVal };
                  if (newVal) milestoneUpdates.endDate = task.startDate;
                  updateTask(task.id, milestoneUpdates);
                }}
              >
                <Diamond className="w-3.5 h-3.5 mr-2" />
                {task.isMilestone ? 'Remove Milestone' : 'Mark as Milestone'}
              </DropdownMenuItem>
            )}
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
          "group grid gap-0 px-4 py-2.5 border-t transition-all duration-200 items-center text-sm",
          "hover:bg-primary/[0.03] hover:shadow-[inset_3px_0_0_0_var(--glow-color)]",
          hasSubTasks && "font-medium bg-muted/10",
          isHighRisk && "animate-[pulse-risk_2s_ease-in-out_infinite] bg-destructive/[0.04]"
        )}
        style={{
          gridTemplateColumns: gridCols,
          borderLeft: isHighRisk ? `4px solid hsl(var(--destructive))` : `4px solid ${bucketColor}15`,
          paddingLeft: `${16 + indent}px`,
          '--glow-color': bucketColor,
        } as React.CSSProperties}
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
          slackDays={slackDays}
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
