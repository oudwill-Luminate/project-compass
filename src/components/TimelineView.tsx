import { useMemo } from 'react';
import {
  format, parseISO, differenceInDays, addDays,
  startOfWeek, endOfWeek, eachWeekOfInterval,
} from 'date-fns';
import { useProject } from '@/context/ProjectContext';
import { OwnerAvatar } from './OwnerAvatar';
import { STATUS_CONFIG } from '@/types/project';

export function TimelineView() {
  const { project } = useProject();

  const allTasks = useMemo(() =>
    project.buckets.flatMap(b =>
      b.tasks.map(t => ({ ...t, bucketName: b.name, bucketColor: b.color }))
    ), [project.buckets]
  );

  const { timelineStart, totalDays, weeks } = useMemo(() => {
    if (allTasks.length === 0) {
      const now = new Date();
      return { timelineStart: now, totalDays: 30, weeks: [] as Date[] };
    }

    const dates = allTasks.flatMap(t => [parseISO(t.startDate), parseISO(t.endDate)]);
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

    const start = addDays(startOfWeek(minDate), -7);
    const end = addDays(endOfWeek(maxDate), 7);
    const total = differenceInDays(end, start);
    const weeksList = eachWeekOfInterval({ start, end });

    return { timelineStart: start, totalDays: total, weeks: weeksList };
  }, [allTasks]);

  const today = new Date();
  const todayPercent = (differenceInDays(today, timelineStart) / totalDays) * 100;

  const getTaskPosition = (taskStart: string, taskEnd: string) => {
    const left = (differenceInDays(parseISO(taskStart), timelineStart) / totalDays) * 100;
    const width = ((differenceInDays(parseISO(taskEnd), parseISO(taskStart)) + 1) / totalDays) * 100;
    return { left: `${Math.max(left, 0)}%`, width: `${Math.max(width, 0.5)}%` };
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="p-6 pb-3">
        <h1 className="text-2xl font-bold text-foreground">Timeline</h1>
        <p className="text-sm text-muted-foreground mt-1">Visual project roadmap</p>
      </div>

      <div className="flex-1 overflow-auto mx-6 mb-6 border rounded-xl">
        <div className="min-w-[1200px] relative">
          {/* Week Headers */}
          <div className="sticky top-0 z-20 bg-background border-b flex">
            <div className="w-[260px] shrink-0 px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-r bg-muted/30">
              Task
            </div>
            <div className="flex-1 relative flex">
              {weeks.map((week, i) => {
                const weekWidth = (7 / totalDays) * 100;
                return (
                  <div
                    key={i}
                    className="text-[11px] text-muted-foreground py-3 text-center border-r border-border/30 shrink-0 bg-muted/10"
                    style={{ width: `${weekWidth}%` }}
                  >
                    {format(week, 'MMM dd')}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Task Rows by Bucket */}
          {project.buckets.map(bucket => (
            <div key={bucket.id}>
              {/* Bucket Header */}
              <div className="flex items-center border-b bg-muted/30">
                <div
                  className="w-[260px] shrink-0 px-4 py-2.5 border-r flex items-center gap-2"
                  style={{ borderLeft: `3px solid ${bucket.color}` }}
                >
                  <span className="text-sm font-bold" style={{ color: bucket.color }}>
                    {bucket.name}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    ({bucket.tasks.length})
                  </span>
                </div>
                <div className="flex-1" />
              </div>

              {/* Task rows */}
              {bucket.tasks.map(task => {
                const pos = getTaskPosition(task.startDate, task.endDate);
                const statusColor = `hsl(var(--${STATUS_CONFIG[task.status].colorVar}))`;

                return (
                  <div
                    key={task.id}
                    className="flex items-center border-b hover:bg-muted/20 transition-colors"
                  >
                    <div className="w-[260px] shrink-0 px-4 py-3 flex items-center gap-2.5 border-r">
                      <OwnerAvatar owner={task.owner} />
                      <span className="text-sm text-foreground truncate">{task.title}</span>
                    </div>
                    <div className="flex-1 relative h-12">
                      {/* Week grid lines */}
                      {weeks.map((_, i) => (
                        <div
                          key={i}
                          className="absolute top-0 bottom-0 border-r border-border/10"
                          style={{
                            left: `${(i * 7 / totalDays) * 100}%`,
                            width: `${(7 / totalDays) * 100}%`,
                          }}
                        />
                      ))}
                      {/* Task Bar */}
                      <div
                        className="absolute top-2.5 h-7 rounded-md shadow-sm cursor-pointer hover:shadow-md hover:brightness-110 transition-all"
                        style={{
                          left: pos.left,
                          width: pos.width,
                          backgroundColor: statusColor,
                        }}
                        title={`${task.title}: ${format(parseISO(task.startDate), 'MMM dd')} – ${format(parseISO(task.endDate), 'MMM dd')}`}
                      >
                        <span className="absolute inset-0 flex items-center px-2 text-[11px] text-white font-medium truncate">
                          {task.title}
                        </span>
                      </div>
                      {/* Today Line */}
                      {todayPercent > 0 && todayPercent < 100 && (
                        <div
                          className="absolute top-0 bottom-0 w-0.5 z-10 pointer-events-none"
                          style={{
                            left: `${todayPercent}%`,
                            backgroundColor: 'hsl(var(--destructive))',
                          }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
