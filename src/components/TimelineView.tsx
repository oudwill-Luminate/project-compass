import { useMemo, useState } from 'react';
import {
  format, parseISO, differenceInDays, addDays,
  startOfWeek, endOfWeek, eachWeekOfInterval,
} from 'date-fns';
import { useProject } from '@/context/ProjectContext';
import { flattenTasks } from '@/hooks/useProjectData';
import { OwnerAvatar } from './OwnerAvatar';
import { ChevronRight, ChevronDown, Shield, AlertTriangle } from 'lucide-react';
import { Task, STATUS_CONFIG } from '@/types/project';

function TaskTimelineRow({
  task,
  depth,
  weeks,
  totalDays,
  timelineStart,
  todayPercent,
  getTaskPosition,
  criticalTaskIds,
}: {
  task: Task;
  depth: number;
  weeks: Date[];
  totalDays: number;
  timelineStart: Date;
  todayPercent: number;
  getTaskPosition: (s: string, e: string) => { left: string; width: string };
  criticalTaskIds: Set<string>;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasSubTasks = task.subTasks.length > 0;
  const isHighRisk = task.flaggedAsRisk && task.riskImpact >= 4;
  const isCritical = criticalTaskIds.has(task.id);

  // Roll-up dates for parents (including children's buffers)
  let displayStart = task.startDate;
  let displayEnd = task.endDate;
  if (hasSubTasks) {
    const subs = task.subTasks;
    const effectiveDates = subs.map(t => {
      const s = t.bufferDays > 0 && t.bufferPosition === 'start'
        ? format(addDays(parseISO(t.startDate), -t.bufferDays), 'yyyy-MM-dd')
        : t.startDate;
      const e = t.bufferDays > 0 && t.bufferPosition === 'end'
        ? format(addDays(parseISO(t.endDate), t.bufferDays), 'yyyy-MM-dd')
        : t.endDate;
      return { s, e };
    });
    displayStart = effectiveDates.reduce((min, d) => d.s < min ? d.s : min, effectiveDates[0].s);
    displayEnd = effectiveDates.reduce((max, d) => d.e > max ? d.e : max, effectiveDates[0].e);
  }

  const pos = getTaskPosition(displayStart, displayEnd);
  const statusColor = hasSubTasks
    ? task.subTasks.some(t => t.status === 'stuck') ? `hsl(var(--${STATUS_CONFIG['stuck'].colorVar}))` :
      task.subTasks.every(t => t.status === 'done') ? `hsl(var(--${STATUS_CONFIG['done'].colorVar}))` :
      task.subTasks.some(t => t.status === 'working' || t.status === 'done') ? `hsl(var(--${STATUS_CONFIG['working'].colorVar}))` :
      `hsl(var(--${STATUS_CONFIG['not-started'].colorVar}))`
    : `hsl(var(--${STATUS_CONFIG[task.status].colorVar}))`;

  return (
    <>
      <div className={`flex items-center border-b hover:bg-muted/20 transition-colors ${isHighRisk ? 'bg-destructive/[0.04]' : ''}`}>
        <div
          className="w-[260px] shrink-0 px-4 py-3 flex items-center gap-1.5 border-r"
          style={{ paddingLeft: `${16 + depth * 20}px` }}
        >
          {hasSubTasks ? (
            <button onClick={() => setExpanded(!expanded)} className="shrink-0 p-0.5 hover:bg-muted rounded">
              {expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
            </button>
          ) : (
            <span className="w-[18px] shrink-0" />
          )}
          <OwnerAvatar owner={task.owner} />
          <span className={`text-sm text-foreground truncate ${hasSubTasks ? 'font-medium' : ''}`}>
            {task.title}
          </span>
          {isHighRisk && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wide text-destructive-foreground bg-destructive px-1.5 py-0.5 rounded-full shrink-0 animate-pulse">
              <AlertTriangle className="w-2.5 h-2.5" />
              Risk
            </span>
          )}
          {hasSubTasks && (
            <span className="text-[10px] text-muted-foreground shrink-0">({task.subTasks.length})</span>
          )}
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
          {(() => {
            const isLeafWorking = task.status === 'working' && !hasSubTasks;
            const parentProgress = hasSubTasks
              ? Math.round(task.subTasks.reduce((sum, t) => sum + (t.progress || 0), 0) / task.subTasks.length)
              : 0;
            const prog = hasSubTasks ? parentProgress : (task.progress || 0);
            const showProgress = (isLeafWorking || (hasSubTasks && parentProgress > 0)) && prog > 0;
            const barBg = showProgress
              ? `linear-gradient(to right, ${statusColor} ${prog}%, color-mix(in srgb, ${statusColor} 20%, transparent) ${prog}%)`
              : statusColor;
            return (
              <div
                className={`absolute top-2.5 h-7 rounded-md shadow-sm cursor-pointer hover:shadow-md hover:brightness-110 transition-all ${hasSubTasks ? 'opacity-60 border-2 border-white/30' : ''} ${isHighRisk ? 'ring-2 ring-destructive/60 ring-offset-1' : ''} ${isCritical && !isHighRisk ? 'ring-2 ring-orange-500 ring-offset-1' : ''}`}
                style={{
                  left: pos.left,
                  width: pos.width,
                  background: barBg,
                }}
                title={`${task.title}: ${format(parseISO(displayStart), 'MMM dd')} – ${format(parseISO(displayEnd), 'MMM dd')}${showProgress ? ` (${prog}%)` : ''}${task.bufferDays > 0 ? ` (+${task.bufferDays}d buffer ${task.bufferPosition})` : ''}`}
              >
                <span className="absolute inset-0 flex items-center justify-between px-2 text-[11px] text-white font-medium truncate">
                  <span className="truncate">{task.title}</span>
                  {showProgress && <span className="shrink-0 ml-1 opacity-90">{prog}%</span>}
                </span>
              </div>
            );
          })()}
          {/* Baseline Bar */}
          {!hasSubTasks && task.baselineStartDate && task.baselineEndDate && (() => {
            const baselinePos = getTaskPosition(task.baselineStartDate, task.baselineEndDate);
            return (
              <div
                className="absolute top-4 h-5 rounded-md bg-muted-foreground/20 border border-muted-foreground/30"
                style={{
                  left: baselinePos.left,
                  width: baselinePos.width,
                }}
                title={`Baseline: ${format(parseISO(task.baselineStartDate), 'MMM dd')} – ${format(parseISO(task.baselineEndDate), 'MMM dd')}`}
              />
            );
          })()}
          {/* Buffer Bar */}
          {!hasSubTasks && task.bufferDays > 0 && (() => {
            const bufferWidth = (task.bufferDays / totalDays) * 100;
            if (task.bufferPosition === 'end') {
              const coreEndPct = (differenceInDays(parseISO(displayEnd), timelineStart) + 1) / totalDays * 100;
              return (
                <div
                  className="absolute top-2.5 h-7 rounded-r-md opacity-40"
                  style={{
                    left: `${coreEndPct}%`,
                    width: `${bufferWidth}%`,
                    backgroundColor: statusColor,
                    backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.3) 3px, rgba(255,255,255,0.3) 6px)',
                  }}
                  title={`Buffer: ${task.bufferDays} days (end)`}
                />
              );
            } else {
              const bufferStartPct = (differenceInDays(parseISO(displayStart), timelineStart) - task.bufferDays) / totalDays * 100;
              return (
                <div
                  className="absolute top-2.5 h-7 rounded-l-md opacity-40"
                  style={{
                    left: `${Math.max(bufferStartPct, 0)}%`,
                    width: `${bufferWidth}%`,
                    backgroundColor: statusColor,
                    backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.3) 3px, rgba(255,255,255,0.3) 6px)',
                  }}
                  title={`Buffer: ${task.bufferDays} days (start)`}
                />
              );
            }
          })()}
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
      {/* Render sub-tasks */}
      {expanded && hasSubTasks && task.subTasks.map(sub => (
        <TaskTimelineRow
          key={sub.id}
          task={sub}
          depth={depth + 1}
          weeks={weeks}
          totalDays={totalDays}
          timelineStart={timelineStart}
          todayPercent={todayPercent}
          getTaskPosition={getTaskPosition}
          criticalTaskIds={criticalTaskIds}
        />
      ))}
    </>
  );
}

export function TimelineView() {
  const { project } = useProject();
  const [collapsedBuckets, setCollapsedBuckets] = useState<Set<string>>(new Set());

  const toggleBucketCollapse = (bucketId: string) => {
    setCollapsedBuckets(prev => {
      const next = new Set(prev);
      if (next.has(bucketId)) next.delete(bucketId);
      else next.add(bucketId);
      return next;
    });
  };

  const allTasks = useMemo(() =>
    project.buckets.flatMap(b => flattenTasks(b.tasks).map(t => ({ ...t, bucketName: b.name, bucketColor: b.color })))
  , [project.buckets]);

  // Critical Path: forward/backward pass to find tasks with zero float
  const criticalTaskIds = useMemo(() => {
    const tasks = allTasks.filter(t => t.subTasks.length === 0); // leaf tasks only
    if (tasks.length === 0) return new Set<string>();

    const taskMap = new Map(tasks.map(t => [t.id, t]));

    // Forward pass: ES and EF
    const es = new Map<string, number>();
    const ef = new Map<string, number>();

    const getES = (id: string): number => {
      if (es.has(id)) return es.get(id)!;
      const t = taskMap.get(id)!;
      const start = parseISO(t.startDate).getTime();
      if (!t.dependsOn || !taskMap.has(t.dependsOn)) {
        es.set(id, start);
        return start;
      }
      const predEF = getEF(t.dependsOn);
      const earliest = Math.max(start, predEF + 86400000); // +1 day
      es.set(id, earliest);
      return earliest;
    };

    const getEF = (id: string): number => {
      if (ef.has(id)) return ef.get(id)!;
      const t = taskMap.get(id)!;
      const dur = differenceInDays(parseISO(t.endDate), parseISO(t.startDate));
      const finish = getES(id) + dur * 86400000;
      ef.set(id, finish);
      return finish;
    };

    // Compute all forward pass values
    tasks.forEach(t => getEF(t.id));

    // Project end = max EF
    const projectEnd = Math.max(...Array.from(ef.values()));

    // Backward pass: LF and LS
    const lf = new Map<string, number>();
    const ls = new Map<string, number>();

    // Find which tasks are depended on by others
    const dependents = new Map<string, string[]>();
    tasks.forEach(t => {
      if (t.dependsOn && taskMap.has(t.dependsOn)) {
        const deps = dependents.get(t.dependsOn) || [];
        deps.push(t.id);
        dependents.set(t.dependsOn, deps);
      }
    });

    const getLF = (id: string): number => {
      if (lf.has(id)) return lf.get(id)!;
      const successors = dependents.get(id);
      if (!successors || successors.length === 0) {
        lf.set(id, projectEnd);
        return projectEnd;
      }
      const latest = Math.min(...successors.map(sId => getLS(sId) - 86400000));
      lf.set(id, latest);
      return latest;
    };

    const getLS = (id: string): number => {
      if (ls.has(id)) return ls.get(id)!;
      const t = taskMap.get(id)!;
      const dur = differenceInDays(parseISO(t.endDate), parseISO(t.startDate));
      const start = getLF(id) - dur * 86400000;
      ls.set(id, start);
      return start;
    };

    tasks.forEach(t => getLS(t.id));

    // Critical = float (LS - ES) === 0
    const critical = new Set<string>();
    tasks.forEach(t => {
      const float = (ls.get(t.id)! - es.get(t.id)!);
      if (Math.abs(float) < 86400000) { // within 1 day tolerance
        critical.add(t.id);
      }
    });

    return critical;
  }, [allTasks]);

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
      <div className="p-6 pb-3 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Timeline</h1>
          <p className="text-sm text-muted-foreground mt-1">Visual project roadmap</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-3 rounded-sm bg-primary" />
            <span>Task</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-5 h-3 rounded-sm opacity-50"
              style={{
                backgroundColor: 'hsl(var(--primary))',
                backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.4) 2px, rgba(255,255,255,0.4) 4px)',
              }}
            />
            <span>Buffer</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-destructive" />
            <span>Today</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-3 rounded-sm bg-muted-foreground/20 border border-muted-foreground/30" />
            <span>Baseline</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-3 rounded-sm border-2 border-orange-500 bg-transparent" />
            <span>Critical Path</span>
          </div>
        </div>
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
              <div
                className="flex items-center border-b bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleBucketCollapse(bucket.id)}
              >
                <div
                  className="w-[260px] shrink-0 px-4 py-2.5 border-r flex items-center gap-2"
                  style={{ borderLeft: `3px solid ${bucket.color}` }}
                >
                  {collapsedBuckets.has(bucket.id)
                    ? <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  }
                  <span className="text-sm font-bold" style={{ color: bucket.color }}>
                    {bucket.name}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    ({flattenTasks(bucket.tasks).length})
                  </span>
                </div>
                <div className="flex-1" />
              </div>

              {/* Task rows (recursive) */}
              {!collapsedBuckets.has(bucket.id) && bucket.tasks.map(task => (
                <TaskTimelineRow
                  key={task.id}
                  task={task}
                  depth={0}
                  weeks={weeks}
                  totalDays={totalDays}
                  timelineStart={timelineStart}
                  todayPercent={todayPercent}
                  getTaskPosition={getTaskPosition}
                  criticalTaskIds={criticalTaskIds}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
