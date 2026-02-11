import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, MoreHorizontal, Link, GripVertical, Trash2, ChevronRight, ChevronDown, Plus } from 'lucide-react';
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
  const startDate = subs.reduce((min, t) => t.startDate < min ? t.startDate : min, subs[0].startDate);
  const endDate = subs.reduce((max, t) => t.endDate > max ? t.endDate : max, subs[0].endDate);

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
}

export function TaskRow({ task, bucketId, bucketColor, depth = 0, dragHandleProps }: TaskRowProps) {
  const { updateTask, deleteTask, getTaskById, addTask } = useProject();
  const [editOpen, setEditOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [addingSubTask, setAddingSubTask] = useState(false);
  const [subTaskTitle, setSubTaskTitle] = useState('');

  const hasSubTasks = task.subTasks.length > 0;
  const rolled = getRolledUp(task);

  const statusConfig = STATUS_CONFIG[rolled.status];
  const priorityConfig = PRIORITY_CONFIG[task.priority];
  const dependsOnTask = task.dependsOn ? getTaskById(task.dependsOn) : null;

  const cycleStatus = () => {
    if (hasSubTasks) return; // can't cycle parent status — it's computed
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

  return (
    <>
      <div
        className={cn(
          "grid grid-cols-[24px_1fr_140px_100px_100px_110px_110px_110px_110px_50px] gap-0 px-4 py-2.5 border-t hover:bg-muted/40 transition-colors items-center text-sm",
          hasSubTasks && "font-medium bg-muted/10"
        )}
        style={{ borderLeft: `4px solid ${bucketColor}15`, paddingLeft: `${16 + indent}px` }}
      >
        <div className="flex items-center gap-0.5">
          {dragHandleProps && depth === 0 ? (
            <div {...dragHandleProps} className="flex items-center cursor-grab active:cursor-grabbing">
              <GripVertical className="w-3.5 h-3.5 text-muted-foreground/50" />
            </div>
          ) : (
            <div className="w-3.5" />
          )}
        </div>
        <div className="flex items-center gap-2 min-w-0">
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
            <span
              className="text-muted-foreground shrink-0"
              title={`Depends on: ${dependsOnTask?.title || task.dependsOn}`}
            >
              <Link className="w-3 h-3" />
            </span>
          )}
          {task.flaggedAsRisk && (
            <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
          )}
        </div>

        <button
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

        <button
          onClick={cyclePriority}
          className="text-xs font-medium px-2 py-1 rounded text-center cursor-pointer transition-transform hover:scale-105"
          style={{
            backgroundColor: `hsl(var(--${priorityConfig.colorVar}) / 0.12)`,
            color: `hsl(var(--${priorityConfig.colorVar}))`,
          }}
        >
          {priorityConfig.label}
        </button>

        <div className="flex items-center gap-1.5">
          <OwnerAvatar owner={task.owner} />
        </div>

        <span className="text-muted-foreground text-xs">
          {format(parseISO(rolled.startDate), 'MMM dd')}
        </span>

        <span className="text-muted-foreground text-xs">
          {format(parseISO(rolled.endDate), 'MMM dd')}
        </span>

        <span className="text-right font-medium tabular-nums">
          ${rolled.estimatedCost.toLocaleString()}
        </span>

        <span className={cn(
          'text-right font-medium tabular-nums',
          rolled.actualCost > rolled.estimatedCost && 'text-destructive'
        )}>
          ${rolled.actualCost.toLocaleString()}
        </span>

        <div className="flex justify-end">
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
      </div>

      {/* Sub-tasks */}
      {expanded && hasSubTasks && task.subTasks.map(sub => (
        <TaskRow
          key={sub.id}
          task={sub}
          bucketId={bucketId}
          bucketColor={bucketColor}
          depth={depth + 1}
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
