import { useMemo } from 'react';
import { parseISO, eachDayOfInterval, format } from 'date-fns';
import { useProject } from '@/context/ProjectContext';
import { flattenTasks } from '@/hooks/useProjectData';
import { OwnerAvatar } from './OwnerAvatar';
import { Task } from '@/types/project';
import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';

interface MemberWorkload {
  userId: string;
  name: string;
  color: string;
  taskCount: number;
  totalEffortHours: number;
  overAllocatedDays: { date: string; hours: number }[];
}

export function WorkloadView() {
  const { project, members } = useProject();

  const workloads = useMemo(() => {
    const allTasks = project.buckets.flatMap(b => flattenTasks(b.tasks));

    // Group tasks by owner
    const tasksByOwner = new Map<string, Task[]>();
    for (const task of allTasks) {
      if (task.owner.id === 'unknown') continue;
      const existing = tasksByOwner.get(task.owner.id) || [];
      existing.push(task);
      tasksByOwner.set(task.owner.id, existing);
    }

    const result: MemberWorkload[] = [];

    // Include all members, even those with no tasks
    const allUserIds = new Set<string>();
    members.forEach(m => allUserIds.add(m.user_id));
    tasksByOwner.forEach((_, id) => allUserIds.add(id));

    for (const userId of allUserIds) {
      const tasks = tasksByOwner.get(userId) || [];
      const member = members.find(m => m.user_id === userId);
      const name = member?.profile?.display_name || 'Unknown';
      const totalEffortHours = tasks.reduce((s, t) => s + t.effortHours, 0);

      // Calculate daily load: distribute effort hours evenly across task duration
      const dailyLoad = new Map<string, number>();
      for (const task of tasks) {
        if (task.effortHours <= 0) continue;
        try {
          const start = parseISO(task.startDate);
          const end = parseISO(task.endDate);
          const days = eachDayOfInterval({ start, end });
          const hoursPerDay = days.length > 0 ? task.effortHours / days.length : 0;
          for (const day of days) {
            const key = format(day, 'yyyy-MM-dd');
            dailyLoad.set(key, (dailyLoad.get(key) || 0) + hoursPerDay);
          }
        } catch {
          // skip invalid dates
        }
      }

      const overAllocatedDays = Array.from(dailyLoad.entries())
        .filter(([, hours]) => hours > 8)
        .map(([date, hours]) => ({ date, hours: Math.round(hours * 10) / 10 }))
        .sort((a, b) => a.date.localeCompare(b.date));

      result.push({
        userId,
        name,
        color: tasks[0]?.owner.color || '#999',
        taskCount: tasks.length,
        totalEffortHours,
        overAllocatedDays,
      });
    }

    return result.sort((a, b) => b.totalEffortHours - a.totalEffortHours);
  }, [project.buckets, members]);

  const totalEffort = workloads.reduce((s, w) => s + w.totalEffortHours, 0);
  const overAllocatedCount = workloads.filter(w => w.overAllocatedDays.length > 0).length;

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Workload</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Team allocation and effort distribution
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="rounded-xl border bg-muted/20 p-4">
            <p className="text-xs text-muted-foreground mb-1">Team Members</p>
            <p className="text-2xl font-bold text-foreground tabular-nums">{workloads.length}</p>
          </div>
          <div className="rounded-xl border bg-muted/20 p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Effort</p>
            <p className="text-2xl font-bold text-foreground tabular-nums">{totalEffort}h</p>
          </div>
          <div className="rounded-xl border bg-muted/20 p-4">
            <p className="text-xs text-muted-foreground mb-1">Avg per Member</p>
            <p className="text-2xl font-bold text-foreground tabular-nums">
              {workloads.length > 0 ? Math.round(totalEffort / workloads.length) : 0}h
            </p>
          </div>
          <div className={cn("rounded-xl border p-4", overAllocatedCount > 0 ? "bg-destructive/10 border-destructive/30" : "bg-muted/20")}>
            <p className="text-xs text-muted-foreground mb-1">Over-allocated</p>
            <p className={cn("text-2xl font-bold tabular-nums", overAllocatedCount > 0 ? "text-destructive" : "text-foreground")}>
              {overAllocatedCount} <span className="text-xs font-normal text-muted-foreground">members</span>
            </p>
          </div>
        </div>

        {/* Member Table */}
        <div className="rounded-xl border overflow-hidden">
          <div className="grid grid-cols-[1fr_100px_120px_1fr] gap-0 px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30 border-b">
            <span>Member</span>
            <span className="text-right">Tasks</span>
            <span className="text-right">Effort Hours</span>
            <span className="pl-4">Over-allocation</span>
          </div>

          {workloads.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No team members assigned to tasks yet.
            </div>
          ) : (
            workloads.map(w => {
              const isOverAllocated = w.overAllocatedDays.length > 0;
              return (
                <div
                  key={w.userId}
                  className={cn(
                    "grid grid-cols-[1fr_100px_120px_1fr] gap-0 px-4 py-3 border-b last:border-b-0 items-center transition-colors hover:bg-muted/20",
                    isOverAllocated && "bg-destructive/[0.04]"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <OwnerAvatar owner={{ id: w.userId, name: w.name, color: w.color }} />
                    <span className={cn("text-sm font-medium", isOverAllocated && "text-destructive")}>
                      {w.name}
                    </span>
                    {isOverAllocated && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-destructive-foreground bg-destructive px-1.5 py-0.5 rounded-full shrink-0">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        Over-allocated
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-right tabular-nums text-foreground">
                    {w.taskCount}
                  </span>
                  <span className="text-sm text-right tabular-nums font-medium text-foreground">
                    {w.totalEffortHours}h
                  </span>
                  <div className="pl-4">
                    {isOverAllocated ? (
                      <div className="flex flex-wrap gap-1.5">
                        {w.overAllocatedDays.slice(0, 5).map(d => (
                          <span
                            key={d.date}
                            className="text-[10px] font-medium bg-destructive/10 text-destructive px-2 py-0.5 rounded-full tabular-nums"
                          >
                            {format(parseISO(d.date), 'MMM dd')}: {d.hours}h
                          </span>
                        ))}
                        {w.overAllocatedDays.length > 5 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{w.overAllocatedDays.length - 5} more
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}