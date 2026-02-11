import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, MoreHorizontal, Link } from 'lucide-react';
import { Task, STATUS_CONFIG, PRIORITY_CONFIG, TaskStatus, TaskPriority } from '@/types/project';
import { useProject } from '@/context/ProjectContext';
import { OwnerAvatar } from './OwnerAvatar';
import { TaskDialog } from './TaskDialog';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TaskRowProps {
  task: Task;
  bucketColor: string;
}

export function TaskRow({ task, bucketColor }: TaskRowProps) {
  const { updateTask, getTaskById } = useProject();
  const [editOpen, setEditOpen] = useState(false);

  const statusConfig = STATUS_CONFIG[task.status];
  const priorityConfig = PRIORITY_CONFIG[task.priority];
  const dependsOnTask = task.dependsOn ? getTaskById(task.dependsOn) : null;

  const cycleStatus = () => {
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

  return (
    <>
      <div
        className="grid grid-cols-[1fr_140px_100px_100px_110px_110px_110px_110px_50px] gap-0 px-4 py-2.5 border-t hover:bg-muted/40 transition-colors items-center text-sm"
        style={{ borderLeft: `4px solid ${bucketColor}15` }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-foreground truncate">{task.title}</span>
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
          className="text-xs font-medium px-3 py-1.5 rounded-full text-white text-center cursor-pointer transition-transform hover:scale-105 truncate"
          style={{ backgroundColor: `hsl(var(--${statusConfig.colorVar}))` }}
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
          {format(parseISO(task.startDate), 'MMM dd')}
        </span>

        <span className="text-muted-foreground text-xs">
          {format(parseISO(task.endDate), 'MMM dd')}
        </span>

        <span className="text-right font-medium tabular-nums">
          ${task.estimatedCost.toLocaleString()}
        </span>

        <span className={cn(
          'text-right font-medium tabular-nums',
          task.actualCost > task.estimatedCost && 'text-destructive'
        )}>
          ${task.actualCost.toLocaleString()}
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
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <TaskDialog task={task} open={editOpen} onOpenChange={setEditOpen} />
    </>
  );
}
