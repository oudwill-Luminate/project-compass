import { differenceInDays, parseISO } from 'date-fns';
import { Task } from '@/types/project';

export interface CriticalPathResult {
  /** Set of task IDs on the critical path (zero float) */
  criticalTaskIds: Set<string>;
  /** Map of task ID → total float in days (how many days a task can slip) */
  slackDays: Map<string, number>;
}

const DAY_MS = 86400000;

/**
 * Compute critical path analysis using forward/backward pass.
 * Only considers leaf tasks (no sub-tasks).
 * Returns both the set of critical task IDs and a slack-days map.
 */
export function computeCriticalPath(allTasks: Task[]): CriticalPathResult {
  const tasks = allTasks.filter(t => t.subTasks.length === 0);
  if (tasks.length === 0) {
    return { criticalTaskIds: new Set(), slackDays: new Map() };
  }

  const taskMap = new Map(tasks.map(t => [t.id, t]));

  // Forward pass: Earliest Start (ES) and Earliest Finish (EF)
  const es = new Map<string, number>();
  const ef = new Map<string, number>();

  const getES = (id: string): number => {
    if (es.has(id)) return es.get(id)!;
    const t = taskMap.get(id)!;
    const start = parseISO(t.startDate).getTime();
    const deps = t.dependencies?.length > 0 ? t.dependencies : (t.dependsOn && taskMap.has(t.dependsOn) ? [{ predecessorId: t.dependsOn, type: t.dependencyType }] : []);
    if (deps.length === 0) {
      es.set(id, start);
      return start;
    }
    const earliest = Math.max(start, ...deps.filter(d => taskMap.has(d.predecessorId)).map(d => getEF(d.predecessorId) + DAY_MS));
    es.set(id, earliest);
    return earliest;
  };

  const getEF = (id: string): number => {
    if (ef.has(id)) return ef.get(id)!;
    const t = taskMap.get(id)!;
    const dur = differenceInDays(parseISO(t.endDate), parseISO(t.startDate));
    const finish = getES(id) + dur * DAY_MS;
    ef.set(id, finish);
    return finish;
  };

  // Compute all forward pass values
  tasks.forEach(t => getEF(t.id));

  // Project end = max EF
  const projectEnd = Math.max(...Array.from(ef.values()));

  // Backward pass: Latest Finish (LF) and Latest Start (LS)
  const lf = new Map<string, number>();
  const ls = new Map<string, number>();

  // Build successor map
  const successors = new Map<string, string[]>();
  tasks.forEach(t => {
    const deps = t.dependencies?.length > 0 ? t.dependencies : (t.dependsOn && taskMap.has(t.dependsOn) ? [{ predecessorId: t.dependsOn, type: t.dependencyType }] : []);
    deps.forEach(d => {
      if (taskMap.has(d.predecessorId)) {
        const list = successors.get(d.predecessorId) || [];
        list.push(t.id);
        successors.set(d.predecessorId, list);
      }
    });
  });

  const getLF = (id: string): number => {
    if (lf.has(id)) return lf.get(id)!;
    const succs = successors.get(id);
    if (!succs || succs.length === 0) {
      lf.set(id, projectEnd);
      return projectEnd;
    }
    const latest = Math.min(...succs.map(sId => getLS(sId) - DAY_MS));
    lf.set(id, latest);
    return latest;
  };

  const getLS = (id: string): number => {
    if (ls.has(id)) return ls.get(id)!;
    const t = taskMap.get(id)!;
    const dur = differenceInDays(parseISO(t.endDate), parseISO(t.startDate));
    const start = getLF(id) - dur * DAY_MS;
    ls.set(id, start);
    return start;
  };

  tasks.forEach(t => getLS(t.id));

  // Compute float and critical set
  const criticalTaskIds = new Set<string>();
  const slackDays = new Map<string, number>();

  tasks.forEach(t => {
    const floatMs = ls.get(t.id)! - es.get(t.id)!;
    const floatDays = Math.max(0, Math.round(floatMs / DAY_MS));
    slackDays.set(t.id, floatDays);
    if (floatDays === 0) {
      criticalTaskIds.add(t.id);
    }
  });

  return { criticalTaskIds, slackDays };
}
