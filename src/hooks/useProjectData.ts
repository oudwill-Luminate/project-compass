import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Project, Bucket, Task, Owner, DependencyType, TaskStatus, TaskPriority, TaskDependency, ScheduleConstraintType } from '@/types/project';
import { useAuth } from '@/context/AuthContext';
import { differenceInDays, parseISO, addDays, format } from 'date-fns';
import { toast } from 'sonner';
import { computeCriticalPath } from '@/lib/criticalPath';

interface ProfileRow {
  id: string;
  display_name: string;
  avatar_url: string | null;
  job_title: string;
  hourly_rate: number;
}

interface BucketRow {
  id: string;
  project_id: string;
  name: string;
  color: string;
  position: number;
  description: string;
  owner_id: string | null;
}

interface TaskRow {
  id: string;
  bucket_id: string;
  title: string;
  status: string;
  priority: string;
  owner_id: string | null;
  start_date: string;
  end_date: string;
  estimated_cost: number;
  actual_cost: number;
  depends_on: string | null;
  dependency_type: string;
  flagged_as_risk: boolean;
  risk_impact: number;
  risk_probability: number;
  position: number;
  parent_task_id: string | null;
  buffer_days: number;
  buffer_position: string;
  responsible: string | null;
  progress: number;
  risk_description: string;
  effort_hours: number;
  baseline_start_date: string | null;
  baseline_end_date: string | null;
  realized_cost: number;
}

const COLORS = ['#0073EA', '#00C875', '#A25DDC', '#FDAB3D', '#E2445C', '#579BFC', '#FF642E'];

function buildTaskTree(taskRows: TaskRow[], profileMap: Record<string, ProfileRow>, depMap?: Map<string, TaskDependency[]>, exclMap?: Map<string, string[]>): Task[] {
  const taskMap = new Map<string, Task>();

  // First pass: create all tasks
  for (const t of taskRows) {
    const ownerId = t.owner_id;
    const ownerProfile = ownerId && profileMap[ownerId];
    const idx = ownerId ? Object.keys(profileMap).indexOf(ownerId) : 0;
    taskMap.set(t.id, {
      id: t.id,
      title: t.title,
      status: t.status as Task['status'],
      priority: t.priority as Task['priority'],
      owner: ownerProfile
        ? { id: ownerProfile.id, name: ownerProfile.display_name, color: COLORS[idx % COLORS.length] }
        : { id: 'unknown', name: 'Unassigned', color: '#999' },
      startDate: t.start_date,
      endDate: t.end_date,
      estimatedCost: Number(t.estimated_cost) || (Number(t.effort_hours) > 0 && ownerId && profileMap[ownerId]?.hourly_rate > 0 ? Number(t.effort_hours) * profileMap[ownerId].hourly_rate : 0),
      actualCost: Number(t.actual_cost),
      dependsOn: t.depends_on,
      dependencyType: (t.dependency_type || 'FS') as DependencyType,
      dependencies: [], // populated later from junction table
      flaggedAsRisk: t.flagged_as_risk,
      riskImpact: t.risk_impact,
      riskProbability: t.risk_probability,
      riskDescription: t.risk_description || '',
      parentTaskId: t.parent_task_id,
      bufferDays: t.buffer_days || 0,
      bufferPosition: (t.buffer_position === 'start' ? 'start' : 'end') as 'start' | 'end',
      isMilestone: (t as any).is_milestone || false,
      responsible: t.responsible || null,
      progress: t.progress || 0,
      effortHours: Number(t.effort_hours) || 0,
      baselineStartDate: t.baseline_start_date || null,
      baselineEndDate: t.baseline_end_date || null,
      realizedCost: Number(t.realized_cost) || 0,
      constraintType: ((t as any).constraint_type || 'ASAP') as ScheduleConstraintType,
      constraintDate: (t as any).constraint_date || null,
      exclusionLinks: exclMap?.get(t.id) || [],
      subTasks: [],
    });
  }

  // Populate dependencies from junction table
  if (depMap) {
    for (const [taskId, deps] of depMap) {
      const task = taskMap.get(taskId);
      if (task) {
        task.dependencies = deps;
        // Backward compat: set dependsOn to first predecessor
        if (deps.length > 0) {
          task.dependsOn = deps[0].predecessorId;
          task.dependencyType = deps[0].type;
        }
      }
    }
  }

  // Second pass: nest children under parents
  const topLevel: Task[] = [];
  for (const t of taskRows) {
    const task = taskMap.get(t.id)!;
    if (t.parent_task_id && taskMap.has(t.parent_task_id)) {
      taskMap.get(t.parent_task_id)!.subTasks.push(task);
    } else {
      topLevel.push(task);
    }
  }

  return topLevel;
}

/** Flatten a task tree into a flat list (for dependency dropdowns, etc.) */
export function flattenTasks(tasks: Task[]): Task[] {
  const result: Task[] = [];
  for (const t of tasks) {
    result.push(t);
    if (t.subTasks.length > 0) {
      result.push(...flattenTasks(t.subTasks));
    }
  }
  return result;
}

/** Helper to recursively update a task in a tree */
function updateTaskInTree(tasks: Task[], taskId: string, updates: Partial<Task>): Task[] {
  return tasks.map(t => {
    if (t.id === taskId) return { ...t, ...updates };
    if (t.subTasks.length > 0) {
      return { ...t, subTasks: updateTaskInTree(t.subTasks, taskId, updates) };
    }
    return t;
  });
}

/** Helper to recursively remove a task from a tree */
function removeTaskFromTree(tasks: Task[], taskId: string): Task[] {
  return tasks
    .filter(t => t.id !== taskId)
    .map(t => t.subTasks.length > 0 ? { ...t, subTasks: removeTaskFromTree(t.subTasks, taskId) } : t);
}

/** Helper to recursively find a task in a tree */
function findTaskInTree(tasks: Task[], taskId: string): Task | undefined {
  for (const t of tasks) {
    if (t.id === taskId) return t;
    if (t.subTasks.length > 0) {
      const found = findTaskInTree(t.subTasks, taskId);
      if (found) return found;
    }
  }
  return undefined;
}

/** Add a sub-task to a parent task in the tree */
function addSubTaskToTree(tasks: Task[], parentTaskId: string, newTask: Task): Task[] {
  return tasks.map(t => {
    if (t.id === parentTaskId) {
      return { ...t, subTasks: [...t.subTasks, newTask] };
    }
    if (t.subTasks.length > 0) {
      return { ...t, subTasks: addSubTaskToTree(t.subTasks, parentTaskId, newTask) };
    }
    return t;
  });
}

/** Compute the effective (rolled-up) start/end dates for a task.
 *  Leaf tasks return their stored dates; parent tasks return min(sub-start) / max(sub-end),
 *  accounting for buffer days/position on each sub-task. */
function getEffectiveDates(task: Task): { startDate: string; endDate: string } {
  if (task.subTasks.length === 0) {
    return { startDate: task.startDate, endDate: task.endDate };
  }
  const effectiveDates = task.subTasks.map(t => {
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
  return { startDate, endDate };
}

/** Detect circular dependency using BFS through all dependencies.
 *  Returns the chain of task IDs in the cycle, or null if no cycle. */
function detectCircularDependency(
  taskId: string,
  proposedDeps: TaskDependency[],
  allTasks: Task[]
): string[] | null {
  // BFS from each proposed predecessor to see if we can reach taskId
  for (const dep of proposedDeps) {
    const queue: string[] = [dep.predecessorId];
    const visited = new Set<string>();
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === taskId) return [taskId, dep.predecessorId, current];
      if (visited.has(current)) continue;
      visited.add(current);
      const task = allTasks.find(t => t.id === current);
      if (!task) continue;
      const taskDeps = task.dependencies.length > 0 ? task.dependencies : (task.dependsOn ? [{ predecessorId: task.dependsOn, type: task.dependencyType }] : []);
      taskDeps.forEach(d => queue.push(d.predecessorId));
    }
  }
  return null;
}

/** Add working days, skipping weekends when includeWeekends is false */
function addWorkingDays(start: Date, days: number, includeWeekends: boolean): Date {
  if (includeWeekends) return addDays(start, days);
  let result = start;
  let remaining = Math.abs(days);
  const direction = days >= 0 ? 1 : -1;
  while (remaining > 0) {
    result = addDays(result, direction);
    const day = result.getDay();
    if (day !== 0 && day !== 6) remaining--;
  }
  return result;
}

/** Advance to next working day if date falls on a weekend */
function nextWorkingDay(date: Date, includeWeekends: boolean): Date {
  if (includeWeekends) return date;
  let d = date;
  while (d.getDay() === 0 || d.getDay() === 6) d = addDays(d, 1);
  return d;
}

/** Count working days between two dates */
function workingDaysDiff(start: Date, end: Date, includeWeekends: boolean): number {
  if (includeWeekends) return differenceInDays(end, start);
  let count = 0;
  let d = start;
  const direction = end >= start ? 1 : -1;
  while (format(d, 'yyyy-MM-dd') !== format(end, 'yyyy-MM-dd')) {
    d = addDays(d, direction);
    const day = d.getDay();
    if (day !== 0 && day !== 6) count += direction;
  }
  return count;
}

/** Calculate new dates for a dependent task based on dependency type, preserving duration.
 *  Buffer is factored in: for FS/FF the predecessor's end buffer extends the effective end date,
 *  for SS/SF the predecessor's start buffer shifts the effective start date earlier. */
function scheduleTask(
  predecessor: { startDate: string; endDate: string; bufferDays?: number; bufferPosition?: 'start' | 'end' },
  dependent: { startDate: string; endDate: string },
  depType: DependencyType,
  includeWeekends: boolean = true
): { startDate: string; endDate: string } {
  const duration = workingDaysDiff(parseISO(dependent.startDate), parseISO(dependent.endDate), includeWeekends);
  const bufferDays = predecessor.bufferDays || 0;
  const bufferPos = predecessor.bufferPosition || 'end';

  // Effective dates accounting for buffer
  const effectiveEnd = bufferPos === 'end'
    ? addWorkingDays(parseISO(predecessor.endDate), bufferDays, includeWeekends)
    : parseISO(predecessor.endDate);
  const effectiveStart = bufferPos === 'start'
    ? addWorkingDays(parseISO(predecessor.startDate), -bufferDays, includeWeekends)
    : parseISO(predecessor.startDate);

  switch (depType) {
    case 'FS': {
      const newStart = nextWorkingDay(addDays(effectiveEnd, 1), includeWeekends);
      return {
        startDate: format(newStart, 'yyyy-MM-dd'),
        endDate: format(addWorkingDays(newStart, duration, includeWeekends), 'yyyy-MM-dd'),
      };
    }
    case 'FF': {
      return {
        startDate: format(addWorkingDays(effectiveEnd, -duration, includeWeekends), 'yyyy-MM-dd'),
        endDate: format(effectiveEnd, 'yyyy-MM-dd'),
      };
    }
    case 'SS': {
      const newStart = nextWorkingDay(effectiveStart, includeWeekends);
      return {
        startDate: format(newStart, 'yyyy-MM-dd'),
        endDate: format(addWorkingDays(newStart, duration, includeWeekends), 'yyyy-MM-dd'),
      };
    }
    case 'SF': {
      const newEnd = nextWorkingDay(addDays(effectiveStart, -1), includeWeekends);
      return {
        startDate: format(addWorkingDays(newEnd, -duration, includeWeekends), 'yyyy-MM-dd'),
        endDate: format(newEnd, 'yyyy-MM-dd'),
      };
    }
    default:
      return { startDate: dependent.startDate, endDate: dependent.endDate };
  }
}

export function useProjectData(projectId: string | undefined) {
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<{ id: string; user_id: string; role: string; profile: ProfileRow }[]>([]);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});

  const toOwner = useCallback((userId: string | null): Owner => {
    if (!userId || !profiles[userId]) {
      return { id: 'unknown', name: 'Unassigned', color: '#999' };
    }
    const p = profiles[userId];
    const idx = Object.keys(profiles).indexOf(userId);
    return { id: p.id, name: p.display_name, color: COLORS[idx % COLORS.length] };
  }, [profiles]);

  const fetchAll = useCallback(async () => {
    if (!projectId || !user) return;

    const [projRes, bucketsRes, , membersRes] = await Promise.all([
      supabase.from('projects').select('*').eq('id', projectId).single(),
      supabase.from('buckets').select('*').eq('project_id', projectId).order('position'),
      supabase.from('tasks').select('*').eq('bucket_id', projectId), // unused, filtered below
      supabase.from('project_members').select('*').eq('project_id', projectId),
    ]);

    if (projRes.error || !projRes.data) {
      setLoading(false);
      return;
    }

    const projData = projRes.data as any;
    const bucketRows = (bucketsRes.data || []) as BucketRow[];
    const bucketIds = bucketRows.map(b => b.id);

    let taskRows: TaskRow[] = [];
    if (bucketIds.length > 0) {
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .in('bucket_id', bucketIds)
        .order('position');
      taskRows = (data || []) as TaskRow[];
    }

    // Fetch task dependencies from junction table
    const taskIds = taskRows.map(t => t.id);
    const depMap = new Map<string, TaskDependency[]>();
    const exclMap = new Map<string, string[]>(); // task_id -> list of excluded task IDs
    if (taskIds.length > 0) {
      const [depRes, exclRes] = await Promise.all([
        supabase
          .from('task_dependencies' as any)
          .select('task_id, predecessor_id, dependency_type')
          .in('task_id', taskIds),
        supabase
          .from('task_exclusions' as any)
          .select('task_a_id, task_b_id')
          .or(`task_a_id.in.(${taskIds.join(',')}),task_b_id.in.(${taskIds.join(',')})`)
      ]);
      if (depRes.data) {
        for (const row of depRes.data as any[]) {
          const existing = depMap.get(row.task_id) || [];
          existing.push({ predecessorId: row.predecessor_id, type: row.dependency_type as DependencyType });
          depMap.set(row.task_id, existing);
        }
      }
      if (exclRes.data) {
        for (const row of exclRes.data as any[]) {
          // Bidirectional: add to both sides
          const aList = exclMap.get(row.task_a_id) || [];
          aList.push(row.task_b_id);
          exclMap.set(row.task_a_id, aList);
          const bList = exclMap.get(row.task_b_id) || [];
          bList.push(row.task_a_id);
          exclMap.set(row.task_b_id, bList);
        }
      }
    }

    const memberRows = (membersRes.data || []) as any[];
    const allUserIds = new Set<string>();
    memberRows.forEach((m: any) => allUserIds.add(m.user_id));
    taskRows.forEach(t => { if (t.owner_id) allUserIds.add(t.owner_id); });
    allUserIds.add(projData.created_by);

    const profileMap: Record<string, ProfileRow> = {};
    if (allUserIds.size > 0) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .in('id', Array.from(allUserIds));
      (profileData || []).forEach((p: any) => { profileMap[p.id] = p as ProfileRow; });
    }
    setProfiles(profileMap);

    // Build project structure with nested sub-tasks
    const buckets: Bucket[] = bucketRows.map(b => ({
      id: b.id,
      name: b.name,
      color: b.color,
      description: b.description || '',
      ownerId: b.owner_id || null,
      collapsed: false,
      tasks: buildTaskTree(taskRows.filter(t => t.bucket_id === b.id), profileMap, depMap, exclMap),
    }));

    const proj: Project = {
      id: projData.id,
      name: projData.name,
      contingencyPercent: Number(projData.contingency_percent),
      includeWeekends: projData.include_weekends ?? false,
      charterMarkdown: projData.charter_markdown || '',
      buckets,
    };

    // Reconcile: fix dependent tasks using ALL dependencies (most restrictive start) + constraints
    const allTasksFlat = buckets.flatMap(b => flattenTasks(b.tasks));
    const includeWeekends = projData.include_weekends ?? false;
    for (const task of allTasksFlat) {
      const deps = task.dependencies.length > 0 ? task.dependencies : (task.dependsOn ? [{ predecessorId: task.dependsOn, type: task.dependencyType }] : []);

      // Compute the most restrictive (latest) start from all predecessors
      let latestStart: string | null = null;
      if (deps.length > 0) {
        for (const dep of deps) {
          const pred = allTasksFlat.find(t => t.id === dep.predecessorId);
          if (!pred) continue;
          const eff = getEffectiveDates(pred);
          const scheduled = scheduleTask(
            { ...pred, startDate: eff.startDate, endDate: eff.endDate },
            task,
            dep.type,
            includeWeekends
          );
          if (!latestStart || scheduled.startDate > latestStart) {
            latestStart = scheduled.startDate;
          }
        }
      }

      const currentDuration = workingDaysDiff(
        parseISO(task.startDate), parseISO(task.endDate), includeWeekends
      );

      // Shift if dependency is violated OR if ASAP task can start earlier
      let finalStart = task.startDate;
      let finalEnd = task.endDate;
      if (latestStart) {
        const shouldShift =
          task.startDate < latestStart ||  // too early (existing logic)
          (task.constraintType === 'ASAP' && task.startDate > latestStart);  // too late — pull forward
        if (shouldShift) {
          finalStart = latestStart;
          finalEnd = format(
            addWorkingDays(parseISO(finalStart), currentDuration, includeWeekends),
            'yyyy-MM-dd'
          );
        }
      }

      // Apply schedule constraint — only override when actually violated
      if (task.constraintType !== 'ASAP' && task.constraintDate) {
        const cd = task.constraintDate;
        switch (task.constraintType) {
          case 'SNET':
            if (cd > finalStart) {
              finalStart = cd;
              finalEnd = format(addWorkingDays(parseISO(finalStart), currentDuration, includeWeekends), 'yyyy-MM-dd');
            }
            break;
          case 'SNLT':
            // Only warn — don't force move if dependency pushed it later
            break;
          case 'MSO':
            // Must constraints always override
            finalStart = cd;
            finalEnd = format(addWorkingDays(parseISO(finalStart), currentDuration, includeWeekends), 'yyyy-MM-dd');
            break;
          case 'MFO':
            finalEnd = cd;
            finalStart = format(addWorkingDays(parseISO(cd), -currentDuration, includeWeekends), 'yyyy-MM-dd');
            break;
          case 'FNET':
            if (cd > finalEnd) finalEnd = cd;
            break;
          case 'FNLT':
            // Only warn — don't force move
            break;
        }
      }

      // Only reconcile in-memory — no DB write to avoid feedback loop
      if (finalStart !== task.startDate || finalEnd !== task.endDate) {
        task.startDate = finalStart;
        task.endDate = finalEnd;
      }
    }

    // Exclusion pass: shift later-starting tasks to avoid overlap with exclusion-linked tasks
    const processed = new Set<string>();
    for (const task of allTasksFlat) {
      if (task.exclusionLinks.length === 0) continue;
      for (const linkedId of task.exclusionLinks) {
        const pairKey = [task.id, linkedId].sort().join('-');
        if (processed.has(pairKey)) continue;
        processed.add(pairKey);
        const linked = allTasksFlat.find(t => t.id === linkedId);
        if (!linked) continue;
        // Check overlap using effective end dates (including buffers)
        const taskEffEnd = task.bufferDays > 0 && task.bufferPosition === 'end'
          ? format(addWorkingDays(parseISO(task.endDate), task.bufferDays, includeWeekends), 'yyyy-MM-dd')
          : task.endDate;
        const linkedEffEnd = linked.bufferDays > 0 && linked.bufferPosition === 'end'
          ? format(addWorkingDays(parseISO(linked.endDate), linked.bufferDays, includeWeekends), 'yyyy-MM-dd')
          : linked.endDate;
        if (task.startDate <= linkedEffEnd && taskEffEnd >= linked.startDate) {
          // Shift the later-starting task
          const laterTask = task.startDate >= linked.startDate ? task : linked;
          const earlierTask = laterTask === task ? linked : task;
          const laterDuration = workingDaysDiff(parseISO(laterTask.startDate), parseISO(laterTask.endDate), includeWeekends);
          // Use earlier task's effective end (with buffer) for shift calculation
          const earlierEffEnd = earlierTask.bufferDays > 0 && earlierTask.bufferPosition === 'end'
            ? addWorkingDays(parseISO(earlierTask.endDate), earlierTask.bufferDays, includeWeekends)
            : parseISO(earlierTask.endDate);
          const newStart = nextWorkingDay(addDays(earlierEffEnd, 1), includeWeekends);
          const newEnd = addWorkingDays(newStart, laterDuration, includeWeekends);
          laterTask.startDate = format(newStart, 'yyyy-MM-dd');
          laterTask.endDate = format(newEnd, 'yyyy-MM-dd');
          // No DB write — in-memory only. Authoritative scheduling via cascade_task_dates RPC.
        }
      }
    }

    // Set project state AFTER reconciliation so UI reflects corrected dates
    setProject(proj);

    setMembers(memberRows.map((m: any) => ({
      id: m.id,
      user_id: m.user_id,
      role: m.role,
      profile: profileMap[m.user_id] || { id: m.user_id, display_name: 'Unknown', avatar_url: null, job_title: '', hourly_rate: 0 } as ProfileRow,
    })));
    setLoading(false);
  }, [projectId, user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`project-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buckets', filter: `project_id=eq.${projectId}` }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: `id=eq.${projectId}` }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_dependencies' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_exclusions' }, () => fetchAll())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [projectId, fetchAll]);

  const updateTask = useCallback(async (taskId: string, updates: Partial<Task>) => {
    if (!project) return;

    const allTasks = project.buckets.flatMap(b => flattenTasks(b.tasks));
    const oldTask = allTasks.find(t => t.id === taskId);
    if (!oldTask) return;

    // Check if dependencies changed (new multi-dep or legacy single dep)
    const dependencyChanged =
      (updates.dependencies !== undefined) ||
      (updates.dependsOn !== undefined && updates.dependsOn !== oldTask.dependsOn) ||
      (updates.dependencyType !== undefined && updates.dependencyType !== oldTask.dependencyType);

    if (dependencyChanged) {
      // Determine new dependencies list
      let newDeps: TaskDependency[] = [];
      if (updates.dependencies !== undefined) {
        newDeps = updates.dependencies;
      } else {
        const predecessorId = updates.dependsOn !== undefined ? updates.dependsOn : oldTask.dependsOn;
        const depType = (updates.dependencyType !== undefined ? updates.dependencyType : oldTask.dependencyType) as DependencyType;
        if (predecessorId) {
          newDeps = [{ predecessorId, type: depType }];
        }
      }

      if (newDeps.length > 0) {
        // Circular dependency check
        const cycle = detectCircularDependency(taskId, newDeps, allTasks);
        if (cycle) {
          const names = cycle.map(id => allTasks.find(t => t.id === id)?.title || 'Unknown').join(' → ');
          toast.error(`Circular dependency: ${names}`);
          return;
        }

        // Schedule using most restrictive predecessor
        let latestScheduled: { startDate: string; endDate: string } | null = null;
        for (const dep of newDeps) {
          let predecessor = allTasks.find(t => t.id === dep.predecessorId);
          if (!predecessor) {
            const { data: predRow } = await supabase
              .from('tasks')
              .select('*')
              .eq('id', dep.predecessorId)
              .single();
            if (predRow) {
              predecessor = {
                id: predRow.id, title: predRow.title,
                status: predRow.status as TaskStatus, priority: predRow.priority as TaskPriority,
                owner: { id: predRow.owner_id || '', name: '', color: '#888' },
                startDate: predRow.start_date, endDate: predRow.end_date,
                estimatedCost: predRow.estimated_cost, actualCost: predRow.actual_cost,
                dependsOn: predRow.depends_on, dependencyType: (predRow.dependency_type || 'FS') as DependencyType,
                dependencies: [],
                flaggedAsRisk: predRow.flagged_as_risk, riskImpact: predRow.risk_impact,
                riskProbability: predRow.risk_probability, riskDescription: predRow.risk_description,
                parentTaskId: predRow.parent_task_id,
                bufferDays: predRow.buffer_days, bufferPosition: (predRow.buffer_position || 'end') as 'start' | 'end',
                responsible: predRow.responsible, progress: predRow.progress,
                effortHours: predRow.effort_hours,
                baselineStartDate: predRow.baseline_start_date, baselineEndDate: predRow.baseline_end_date,
                realizedCost: predRow.realized_cost,
                isMilestone: (predRow as any).is_milestone || false,
                constraintType: ((predRow as any).constraint_type || 'ASAP') as ScheduleConstraintType,
                constraintDate: (predRow as any).constraint_date || null,
                exclusionLinks: [],
                subTasks: [],
              };
            }
          }
          if (predecessor) {
            const effectivePred = getEffectiveDates(predecessor);
            const currentTask = {
              startDate: updates.startDate || oldTask.startDate,
              endDate: updates.endDate || oldTask.endDate,
            };
            const scheduled = scheduleTask(
              { ...predecessor, startDate: effectivePred.startDate, endDate: effectivePred.endDate },
              currentTask,
              dep.type,
              project.includeWeekends
            );
            if (!latestScheduled || scheduled.startDate > latestScheduled.startDate) {
              latestScheduled = scheduled;
            }
          }
        }
        if (latestScheduled) {
          const currentStart = updates.startDate || oldTask.startDate;
          const taskConstraint = (updates.constraintType || oldTask.constraintType) as ScheduleConstraintType;
          if (currentStart < latestScheduled.startDate) {
            // Task starts too early -- always shift forward
            updates = { ...updates, startDate: latestScheduled.startDate, endDate: latestScheduled.endDate };
          } else if (taskConstraint === 'ASAP' && currentStart > latestScheduled.startDate) {
            // ASAP task starts later than needed -- pull it forward
            updates = { ...updates, startDate: latestScheduled.startDate, endDate: latestScheduled.endDate };
          }
        }
      }

      // Sync junction table
      if (updates.dependencies !== undefined) {
        const oldDeps = oldTask.dependencies || [];
        // Delete removed dependencies
        const removedPreds = oldDeps.filter(od => !newDeps.some(nd => nd.predecessorId === od.predecessorId));
        for (const rd of removedPreds) {
          await supabase.from('task_dependencies' as any).delete()
            .eq('task_id', taskId).eq('predecessor_id', rd.predecessorId);
        }
        // Insert new dependencies
        const addedDeps = newDeps.filter(nd => !oldDeps.some(od => od.predecessorId === nd.predecessorId));
        if (addedDeps.length > 0) {
          await supabase.from('task_dependencies' as any).insert(
            addedDeps.map(d => ({ task_id: taskId, predecessor_id: d.predecessorId, dependency_type: d.type }))
          );
        }
        // Update changed types
        const changedDeps = newDeps.filter(nd => {
          const old = oldDeps.find(od => od.predecessorId === nd.predecessorId);
          return old && old.type !== nd.type;
        });
        for (const cd of changedDeps) {
          await supabase.from('task_dependencies' as any).update({ dependency_type: cd.type })
            .eq('task_id', taskId).eq('predecessor_id', cd.predecessorId);
        }
        // Also sync legacy columns for backward compat
        updates.dependsOn = newDeps.length > 0 ? newDeps[0].predecessorId : null;
        updates.dependencyType = newDeps.length > 0 ? newDeps[0].type : 'FS';
      }
    }

    // Handle exclusion links changes
    if (updates.exclusionLinks !== undefined) {
      const oldExclusions = oldTask.exclusionLinks || [];
      const newExclusions = updates.exclusionLinks;
      
      // Delete removed exclusions
      const removed = oldExclusions.filter(id => !newExclusions.includes(id));
      for (const otherId of removed) {
        const [a, b] = [taskId, otherId].sort();
        await supabase.from('task_exclusions' as any).delete()
          .eq('task_a_id', a).eq('task_b_id', b);
      }
      
      // Insert new exclusions
      const added = newExclusions.filter(id => !oldExclusions.includes(id));
      for (const otherId of added) {
        const [a, b] = [taskId, otherId].sort();
        await supabase.from('task_exclusions' as any).insert({ task_a_id: a, task_b_id: b });
      }
    }

    // Optimistic update (recursive)
    setProject(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        buckets: prev.buckets.map(b => ({
          ...b,
          tasks: updateTaskInTree(b.tasks, taskId, updates),
        })),
      };
    });

    const dbUpdates: Record<string, any> = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
    if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate;
    if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate;
    if (updates.estimatedCost !== undefined) dbUpdates.estimated_cost = updates.estimatedCost;
    if (updates.actualCost !== undefined) dbUpdates.actual_cost = updates.actualCost;
    if (updates.dependsOn !== undefined) dbUpdates.depends_on = updates.dependsOn;
    if (updates.dependencyType !== undefined) dbUpdates.dependency_type = updates.dependencyType;
    if (updates.flaggedAsRisk !== undefined) dbUpdates.flagged_as_risk = updates.flaggedAsRisk;
    if (updates.riskImpact !== undefined) dbUpdates.risk_impact = updates.riskImpact;
    if (updates.riskProbability !== undefined) dbUpdates.risk_probability = updates.riskProbability;
    if (updates.riskDescription !== undefined) dbUpdates.risk_description = updates.riskDescription;
    if (updates.parentTaskId !== undefined) dbUpdates.parent_task_id = updates.parentTaskId;
    if (updates.bufferDays !== undefined) dbUpdates.buffer_days = updates.bufferDays;
    if (updates.bufferPosition !== undefined) dbUpdates.buffer_position = updates.bufferPosition;
    if (updates.isMilestone !== undefined) dbUpdates.is_milestone = updates.isMilestone;
    if (updates.responsible !== undefined) dbUpdates.responsible = updates.responsible;
    if (updates.progress !== undefined) dbUpdates.progress = updates.progress;
    if (updates.effortHours !== undefined) dbUpdates.effort_hours = updates.effortHours;
    if (updates.baselineStartDate !== undefined) dbUpdates.baseline_start_date = updates.baselineStartDate;
    if (updates.baselineEndDate !== undefined) dbUpdates.baseline_end_date = updates.baselineEndDate;
    if (updates.realizedCost !== undefined) dbUpdates.realized_cost = updates.realizedCost;
    if (updates.owner !== undefined) dbUpdates.owner_id = updates.owner.id === 'unknown' ? null : updates.owner.id;
    if (updates.constraintType !== undefined) dbUpdates.constraint_type = updates.constraintType;
    if (updates.constraintDate !== undefined) dbUpdates.constraint_date = updates.constraintDate;

    await supabase.from('tasks').update(dbUpdates).eq('id', taskId);

    // Activity logging for tracked fields
    if (projectId && user) {
      const displayName = profiles[user.id]?.display_name || 'Someone';
      const logs: { project_id: string; task_id: string; user_id: string; description: string }[] = [];

      if (updates.endDate !== undefined && updates.endDate !== oldTask.endDate) {
        logs.push({
          project_id: projectId,
          task_id: taskId,
          user_id: user.id,
          description: `${displayName} moved Deadline from ${oldTask.endDate} to ${updates.endDate} on task "${oldTask.title}"`,
        });
      }
      if (updates.estimatedCost !== undefined && updates.estimatedCost !== oldTask.estimatedCost) {
        logs.push({
          project_id: projectId,
          task_id: taskId,
          user_id: user.id,
          description: `${displayName} changed Estimated Cost from $${oldTask.estimatedCost} to $${updates.estimatedCost} on task "${oldTask.title}"`,
        });
      }
      if (updates.status !== undefined && updates.status !== oldTask.status) {
        logs.push({
          project_id: projectId,
          task_id: taskId,
          user_id: user.id,
          description: `${displayName} changed Status from '${oldTask.status}' to '${updates.status}' on task "${oldTask.title}"`,
        });
      }

      if (logs.length > 0) {
        await supabase.from('activity_log').insert(logs);
      }
    }

    // Detect buffer changes alongside date changes
    const updatedTask = { ...oldTask, ...updates };
    const bufferChanged =
      (updates.bufferDays !== undefined && updates.bufferDays !== oldTask.bufferDays) ||
      (updates.bufferPosition !== undefined && updates.bufferPosition !== oldTask.bufferPosition);
    const datesChanged =
      (updates.startDate && updates.startDate !== oldTask.startDate) ||
      (updates.endDate && updates.endDate !== oldTask.endDate) ||
      bufferChanged;

    if (datesChanged) {
      // Pass actual task dates to cascade — the RPC already reads buffer_days/buffer_position
      // from the database and accounts for them when scheduling successors.
      await supabase.rpc('cascade_task_dates', {
        _task_id: taskId,
        _new_start: updatedTask.startDate,
        _new_end: updatedTask.endDate,
        _include_weekends: project.includeWeekends,
      });

      // If this task is a sub-task, also cascade from the parent using rolled-up dates,
      // so any task depending on the parent gets rescheduled correctly.
      if (oldTask.parentTaskId) {
        const parentTask = allTasks.find(t => t.id === oldTask.parentTaskId);
        if (parentTask) {
          const updatedParentSubs = parentTask.subTasks.map(s =>
            s.id === taskId ? { ...s, ...updates } : s
          );
          const subStarts = updatedParentSubs.map(s => s.startDate);
          const subEnds = updatedParentSubs.map(s => s.endDate);
          const parentStart = subStarts.reduce((min, d) => d < min ? d : min, subStarts[0]);
          const parentEnd = subEnds.reduce((max, d) => d > max ? d : max, subEnds[0]);
          await supabase.rpc('cascade_task_dates', {
            _task_id: parentTask.id,
            _new_start: parentStart,
            _new_end: parentEnd,
            _include_weekends: project.includeWeekends,
          });
        }
      }

      // Also cascade exclusion-linked tasks so they get re-evaluated
      if (oldTask.exclusionLinks && oldTask.exclusionLinks.length > 0) {
        for (const linkedId of oldTask.exclusionLinks) {
          const linkedRes = await supabase.from('tasks').select('start_date, end_date').eq('id', linkedId).single();
          if (linkedRes.data) {
            await supabase.rpc('cascade_task_dates', {
              _task_id: linkedId,
              _new_start: linkedRes.data.start_date,
              _new_end: linkedRes.data.end_date,
              _include_weekends: project.includeWeekends,
            });
          }
        }
      }
    }

    // When dependencies changed but dates weren't directly edited, still cascade
    if (dependencyChanged && !datesChanged) {
      const updatedStart = updates.startDate || oldTask.startDate;
      const updatedEnd = updates.endDate || oldTask.endDate;
      await supabase.rpc('cascade_task_dates', {
        _task_id: taskId,
        _new_start: updatedStart,
        _new_end: updatedEnd,
        _include_weekends: project.includeWeekends,
      });
    }
    // Refetch to sync all cascaded changes
    if (datesChanged || dependencyChanged) {
      fetchAll();
    }
  }, [project, fetchAll]);

  const updateContingency = useCallback(async (percent: number) => {
    if (!projectId) return;
    setProject(prev => prev ? { ...prev, contingencyPercent: percent } : prev);
    await supabase.from('projects').update({ contingency_percent: percent }).eq('id', projectId);
  }, [projectId]);

  const updateIncludeWeekends = useCallback(async (value: boolean) => {
    if (!projectId) return;
    setProject(prev => prev ? { ...prev, includeWeekends: value } : prev);
    await supabase.from('projects').update({ include_weekends: value } as any).eq('id', projectId);
  }, [projectId]);

  const addBucket = useCallback(async (name: string) => {
    if (!projectId) return;
    const position = project?.buckets.length ?? 0;
    const color = COLORS[position % COLORS.length];
    const tempId = `temp-${Date.now()}`;

    setProject(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        buckets: [...prev.buckets, { id: tempId, name, color, collapsed: false, tasks: [] }],
      };
    });

    const { error } = await supabase.from('buckets').insert({ project_id: projectId, name, color, position });
    if (error) console.error('addBucket error:', error);
  }, [projectId, project]);

  const updateBucket = useCallback(async (bucketId: string, updates: { name?: string; color?: string; description?: string; owner_id?: string | null }) => {
    setProject(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        buckets: prev.buckets.map(b => b.id === bucketId ? {
          ...b,
          ...(updates.name !== undefined && { name: updates.name }),
          ...(updates.color !== undefined && { color: updates.color }),
          ...(updates.description !== undefined && { description: updates.description }),
          ...(updates.owner_id !== undefined && { ownerId: updates.owner_id }),
        } : b),
      };
    });

    const { error } = await supabase.from('buckets').update(updates).eq('id', bucketId);
    if (error) console.error('updateBucket error:', error);
  }, []);

  const deleteBucket = useCallback(async (bucketId: string) => {
    setProject(prev => {
      if (!prev) return prev;
      return { ...prev, buckets: prev.buckets.filter(b => b.id !== bucketId) };
    });

    await supabase.from('tasks').delete().eq('bucket_id', bucketId);
    const { error } = await supabase.from('buckets').delete().eq('id', bucketId);
    if (error) console.error('deleteBucket error:', error);
  }, []);

  const moveBucket = useCallback(async (bucketId: string, newPosition: number) => {
    setProject(prev => {
      if (!prev) return prev;
      const oldIndex = prev.buckets.findIndex(b => b.id === bucketId);
      if (oldIndex === -1 || oldIndex === newPosition) return prev;
      const newBuckets = [...prev.buckets];
      const [moved] = newBuckets.splice(oldIndex, 1);
      newBuckets.splice(newPosition, 0, moved);
      return { ...prev, buckets: newBuckets };
    });

    // Update all positions in DB
    if (!project) return;
    const oldIndex = project.buckets.findIndex(b => b.id === bucketId);
    if (oldIndex === -1 || oldIndex === newPosition) return;
    const newBuckets = [...project.buckets];
    const [moved] = newBuckets.splice(oldIndex, 1);
    newBuckets.splice(newPosition, 0, moved);

    await Promise.all(
      newBuckets.map((b, i) =>
        supabase.from('buckets').update({ position: i }).eq('id', b.id)
      )
    );
  }, [project]);

  const addTask = useCallback(async (bucketId: string, title: string, parentTaskId?: string) => {
    if (!user) return;
    const today = format(new Date(), 'yyyy-MM-dd');
    const endDate = format(addDays(new Date(), 7), 'yyyy-MM-dd');
    const tempId = `temp-${Date.now()}`;

    const newTask: Task = {
      id: tempId,
      title,
      status: 'not-started',
      priority: 'medium',
      owner: toOwner(user.id),
      startDate: today,
      endDate,
      estimatedCost: 0,
      actualCost: 0,
      dependsOn: null,
      dependencyType: 'FS',
      dependencies: [],
      flaggedAsRisk: false,
      bufferDays: 0,
      bufferPosition: 'end',
      isMilestone: false,
      responsible: null,
      progress: 0,
      effortHours: 0,
      riskImpact: 1,
      riskProbability: 1,
      riskDescription: '',
      parentTaskId: parentTaskId || null,
      baselineStartDate: null,
      baselineEndDate: null,
      realizedCost: 0,
      constraintType: 'ASAP',
      constraintDate: null,
      exclusionLinks: [],
      subTasks: [],
    };

    // Optimistic update
    setProject(prev => {
      if (!prev) return prev;
      if (parentTaskId) {
        return {
          ...prev,
          buckets: prev.buckets.map(b => ({
            ...b,
            tasks: addSubTaskToTree(b.tasks, parentTaskId, newTask),
          })),
        };
      }
      return {
        ...prev,
        buckets: prev.buckets.map(b =>
          b.id === bucketId ? { ...b, tasks: [...b.tasks, newTask] } : b
        ),
      };
    });

    const bucket = project?.buckets.find(b => b.id === bucketId);
    const position = bucket ? flattenTasks(bucket.tasks).length : 0;

    const { error } = await supabase.from('tasks').insert({
      bucket_id: bucketId,
      title,
      position,
      owner_id: user.id,
      start_date: today,
      end_date: endDate,
      parent_task_id: parentTaskId || null,
    });
    if (error) console.error('addTask error:', error);
  }, [user, project, toOwner]);

  const createTaskFull = useCallback(async (bucketId: string, taskData: Omit<Task, 'id' | 'subTasks'>) => {
    if (!user) return;

    const bucket = project?.buckets.find(b => b.id === bucketId);
    const position = bucket ? flattenTasks(bucket.tasks).length : 0;

    const { error } = await supabase.from('tasks').insert({
      bucket_id: bucketId,
      title: taskData.title,
      status: taskData.status,
      priority: taskData.priority,
      owner_id: taskData.owner?.id === 'unknown' ? null : (taskData.owner?.id || user.id),
      start_date: taskData.startDate,
      end_date: taskData.endDate,
      estimated_cost: taskData.estimatedCost,
      actual_cost: taskData.actualCost,
      depends_on: taskData.dependsOn || null,
      dependency_type: taskData.dependencyType,
      flagged_as_risk: taskData.flaggedAsRisk,
      risk_impact: taskData.riskImpact,
      risk_probability: taskData.riskProbability,
      buffer_days: taskData.bufferDays,
      buffer_position: taskData.bufferPosition,
      responsible: taskData.responsible || null,
      parent_task_id: taskData.parentTaskId || null,
      position,
    });
    if (error) console.error('createTaskFull error:', error);
  }, [user, project]);

  const moveTask = useCallback(async (taskId: string, newBucketId: string, newPosition: number) => {
    setProject(prev => {
      if (!prev) return prev;
      let movedTask: Task | undefined;
      const bucketsWithout = prev.buckets.map(b => {
        const idx = b.tasks.findIndex(t => t.id === taskId);
        if (idx !== -1) {
          movedTask = b.tasks[idx];
          return { ...b, tasks: [...b.tasks.slice(0, idx), ...b.tasks.slice(idx + 1)] };
        }
        return b;
      });
      if (!movedTask) return prev;
      return {
        ...prev,
        buckets: bucketsWithout.map(b =>
          b.id === newBucketId
            ? { ...b, tasks: [...b.tasks.slice(0, newPosition), movedTask!, ...b.tasks.slice(newPosition)] }
            : b
        ),
      };
    });

    const { error } = await supabase.from('tasks').update({ bucket_id: newBucketId, position: newPosition }).eq('id', taskId);
    if (error) console.error('moveTask error:', error);
  }, []);

  const deleteTask = useCallback(async (taskId: string) => {
    // Optimistic update (recursive)
    setProject(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        buckets: prev.buckets.map(b => ({
          ...b,
          tasks: removeTaskFromTree(b.tasks, taskId),
        })),
      };
    });

    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) console.error('deleteTask error:', error);
  }, []);

  const updateProjectName = useCallback(async (name: string) => {
    if (!projectId) return;
    setProject(prev => prev ? { ...prev, name } : prev);
    await supabase.from('projects').update({ name }).eq('id', projectId);
  }, [projectId]);

  const deleteProject = useCallback(async () => {
    if (!projectId) return;
    // Delete all tasks in all buckets first
    const bucketIds = project?.buckets.map(b => b.id) || [];
    if (bucketIds.length > 0) {
      await supabase.from('tasks').delete().in('bucket_id', bucketIds);
    }
    await supabase.from('buckets').delete().eq('project_id', projectId);
    await supabase.from('project_members').delete().eq('project_id', projectId);
    await supabase.from('projects').delete().eq('id', projectId);
  }, [projectId, project]);

  const setBaseline = useCallback(async () => {
    if (!project) return;
    const allTasks = project.buckets.flatMap(b => flattenTasks(b.tasks));
    
    // Optimistic update
    setProject(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        buckets: prev.buckets.map(b => ({
          ...b,
          tasks: (function setBaselineInTree(tasks: Task[]): Task[] {
            return tasks.map(t => ({
              ...t,
              baselineStartDate: t.startDate,
              baselineEndDate: t.endDate,
              subTasks: setBaselineInTree(t.subTasks),
            }));
          })(b.tasks),
        })),
      };
    });

    // Bulk update in DB
    await Promise.all(
      allTasks.map(t =>
        supabase.from('tasks').update({
          baseline_start_date: t.startDate,
          baseline_end_date: t.endDate,
        }).eq('id', t.id)
      )
    );
    toast.success('Baseline set for all tasks');
  }, [project]);

  const clearBaseline = useCallback(async () => {
    if (!project) return;
    const allTasks = project.buckets.flatMap(b => flattenTasks(b.tasks));

    setProject(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        buckets: prev.buckets.map(b => ({
          ...b,
          tasks: (function clearInTree(tasks: Task[]): Task[] {
            return tasks.map(t => ({
              ...t,
              baselineStartDate: null,
              baselineEndDate: null,
              subTasks: clearInTree(t.subTasks),
            }));
          })(b.tasks),
        })),
      };
    });

    await Promise.all(
      allTasks.map(t =>
        supabase.from('tasks').update({
          baseline_start_date: null,
          baseline_end_date: null,
        }).eq('id', t.id)
      )
    );
    toast.success('Baseline cleared');
  }, [project]);

  // Charter
  const updateCharter = useCallback(async (markdown: string) => {
    if (!projectId) return;
    setProject(prev => prev ? { ...prev, charterMarkdown: markdown } : prev);
    await supabase.from('projects').update({ charter_markdown: markdown } as any).eq('id', projectId);
  }, [projectId]);

  // Goals
  const [goals, setGoals] = useState<import('@/types/project').ProjectGoal[]>([]);

  const fetchGoals = useCallback(async () => {
    if (!projectId) return;
    const { data } = await supabase
      .from('project_goals' as any)
      .select('*')
      .eq('project_id', projectId)
      .order('position');
    if (data) {
      setGoals((data as any[]).map(g => ({
        id: g.id, projectId: g.project_id, title: g.title,
        progress: g.progress, position: g.position,
      })));
    }
  }, [projectId]);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  const addGoal = useCallback(async (title: string) => {
    if (!projectId) return;
    const position = goals.length;
    await supabase.from('project_goals' as any).insert({ project_id: projectId, title, position } as any);
    fetchGoals();
  }, [projectId, goals.length, fetchGoals]);

  const updateGoal = useCallback(async (goalId: string, updates: Partial<import('@/types/project').ProjectGoal>) => {
    const dbUpdates: any = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.progress !== undefined) dbUpdates.progress = updates.progress;
    if (updates.position !== undefined) dbUpdates.position = updates.position;
    setGoals(prev => prev.map(g => g.id === goalId ? { ...g, ...updates } : g));
    await supabase.from('project_goals' as any).update(dbUpdates).eq('id', goalId);
  }, []);

  const deleteGoal = useCallback(async (goalId: string) => {
    setGoals(prev => prev.filter(g => g.id !== goalId));
    await supabase.from('project_goals' as any).delete().eq('id', goalId);
  }, []);

  // Centralized critical path / slack computation
  const { criticalTaskIds, slackDays } = useMemo(() => {
    if (!project) return { criticalTaskIds: new Set<string>(), slackDays: new Map<string, number>() };
    const allTasks = project.buckets.flatMap(b => flattenTasks(b.tasks));
    return computeCriticalPath(allTasks);
  }, [project]);

  // Persistence-aware refresh: reconcile in-memory, persist changed dates, cascade, re-fetch
  const refreshSchedule = useCallback(async () => {
    if (!project || !projectId) return;

    const allTasks = project.buckets.flatMap(b => flattenTasks(b.tasks));
    const includeWeekends = project.includeWeekends;

    // Build a map of original DB dates (current state before reconciliation)
    const originalDates = new Map<string, { startDate: string; endDate: string }>();
    for (const task of allTasks) {
      originalDates.set(task.id, { startDate: task.startDate, endDate: task.endDate });
    }

    // --- Pass 1: Dependency reconciliation (same as fetchAll) ---
    for (const task of allTasks) {
      const deps = task.dependencies.length > 0
        ? task.dependencies
        : (task.dependsOn ? [{ predecessorId: task.dependsOn, type: task.dependencyType }] : []);

      let latestStart: string | null = null;
      if (deps.length > 0) {
        for (const dep of deps) {
          const pred = allTasks.find(t => t.id === dep.predecessorId);
          if (!pred) continue;
          const eff = getEffectiveDates(pred);
          const scheduled = scheduleTask(
            { ...pred, startDate: eff.startDate, endDate: eff.endDate },
            task,
            dep.type,
            includeWeekends
          );
          if (!latestStart || scheduled.startDate > latestStart) {
            latestStart = scheduled.startDate;
          }
        }
      }

      const currentDuration = workingDaysDiff(
        parseISO(task.startDate), parseISO(task.endDate), includeWeekends
      );

      let finalStart = task.startDate;
      let finalEnd = task.endDate;
      if (latestStart) {
        const shouldShift =
          task.startDate < latestStart ||
          (task.constraintType === 'ASAP' && task.startDate > latestStart);
        if (shouldShift) {
          finalStart = latestStart;
          finalEnd = format(
            addWorkingDays(parseISO(finalStart), currentDuration, includeWeekends),
            'yyyy-MM-dd'
          );
        }
      }

      // Apply schedule constraints
      if (task.constraintType !== 'ASAP' && task.constraintDate) {
        const cd = task.constraintDate;
        switch (task.constraintType) {
          case 'SNET':
            if (cd > finalStart) {
              finalStart = cd;
              finalEnd = format(addWorkingDays(parseISO(finalStart), currentDuration, includeWeekends), 'yyyy-MM-dd');
            }
            break;
          case 'MSO':
            finalStart = cd;
            finalEnd = format(addWorkingDays(parseISO(finalStart), currentDuration, includeWeekends), 'yyyy-MM-dd');
            break;
          case 'MFO':
            finalEnd = cd;
            finalStart = format(addWorkingDays(parseISO(cd), -currentDuration, includeWeekends), 'yyyy-MM-dd');
            break;
          case 'FNET':
            if (cd > finalEnd) finalEnd = cd;
            break;
          default:
            break;
        }
      }

      if (finalStart !== task.startDate || finalEnd !== task.endDate) {
        task.startDate = finalStart;
        task.endDate = finalEnd;
      }
    }

    // --- Pass 2: Exclusion pass (same as fetchAll) ---
    const processed = new Set<string>();
    for (const task of allTasks) {
      if (task.exclusionLinks.length === 0) continue;
      for (const linkedId of task.exclusionLinks) {
        const pairKey = [task.id, linkedId].sort().join('-');
        if (processed.has(pairKey)) continue;
        processed.add(pairKey);
        const linked = allTasks.find(t => t.id === linkedId);
        if (!linked) continue;
        const taskEffEnd = task.bufferDays > 0 && task.bufferPosition === 'end'
          ? format(addWorkingDays(parseISO(task.endDate), task.bufferDays, includeWeekends), 'yyyy-MM-dd')
          : task.endDate;
        const linkedEffEnd = linked.bufferDays > 0 && linked.bufferPosition === 'end'
          ? format(addWorkingDays(parseISO(linked.endDate), linked.bufferDays, includeWeekends), 'yyyy-MM-dd')
          : linked.endDate;
        if (task.startDate <= linkedEffEnd && taskEffEnd >= linked.startDate) {
          const laterTask = task.startDate >= linked.startDate ? task : linked;
          const earlierTask = laterTask === task ? linked : task;
          const laterDuration = workingDaysDiff(parseISO(laterTask.startDate), parseISO(laterTask.endDate), includeWeekends);
          const earlierEffEnd = earlierTask.bufferDays > 0 && earlierTask.bufferPosition === 'end'
            ? addWorkingDays(parseISO(earlierTask.endDate), earlierTask.bufferDays, includeWeekends)
            : parseISO(earlierTask.endDate);
          const newStart = nextWorkingDay(addDays(earlierEffEnd, 1), includeWeekends);
          const newEnd = addWorkingDays(newStart, laterDuration, includeWeekends);
          laterTask.startDate = format(newStart, 'yyyy-MM-dd');
          laterTask.endDate = format(newEnd, 'yyyy-MM-dd');
        }
      }
    }

    // --- Pass 3: Topological sort & persist changed dates ---
    // Build adjacency for topo sort: predecessors before successors
    const taskMap = new Map(allTasks.map(t => [t.id, t]));
    const inDegree = new Map<string, number>();
    const successors = new Map<string, string[]>();
    for (const t of allTasks) {
      if (!inDegree.has(t.id)) inDegree.set(t.id, 0);
      const deps = t.dependencies.length > 0
        ? t.dependencies
        : (t.dependsOn ? [{ predecessorId: t.dependsOn, type: t.dependencyType }] : []);
      for (const dep of deps) {
        inDegree.set(t.id, (inDegree.get(t.id) || 0) + 1);
        const s = successors.get(dep.predecessorId) || [];
        s.push(t.id);
        successors.set(dep.predecessorId, s);
      }
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }
    const topoOrder: string[] = [];
    while (queue.length > 0) {
      const id = queue.shift()!;
      topoOrder.push(id);
      for (const succId of (successors.get(id) || [])) {
        const newDeg = (inDegree.get(succId) || 1) - 1;
        inDegree.set(succId, newDeg);
        if (newDeg === 0) queue.push(succId);
      }
    }
    // Add any remaining tasks not in the topo order (no deps)
    for (const t of allTasks) {
      if (!topoOrder.includes(t.id)) topoOrder.push(t.id);
    }

    // Persist in topological order and cascade each changed task
    let changedCount = 0;
    for (const taskId of topoOrder) {
      const task = taskMap.get(taskId);
      if (!task) continue;
      const orig = originalDates.get(taskId);
      if (!orig) continue;
      if (task.startDate !== orig.startDate || task.endDate !== orig.endDate) {
        changedCount++;
        // Persist the corrected dates
        await supabase.from('tasks').update({
          start_date: task.startDate,
          end_date: task.endDate,
        }).eq('id', taskId);

        // Cascade to successors so the RPC also processes downstream tasks
        await supabase.rpc('cascade_task_dates', {
          _task_id: taskId,
          _new_start: task.startDate,
          _new_end: task.endDate,
          _include_weekends: includeWeekends,
        });
      }
    }

    if (changedCount > 0) {
      toast.success(`Schedule refreshed: ${changedCount} task${changedCount > 1 ? 's' : ''} updated`);
    } else {
      toast.info('Schedule is already up to date');
    }

    // --- Pass 4: Re-fetch to reflect final persisted state ---
    await fetchAll();
  }, [project, projectId, fetchAll]);

  return { project, members, loading, updateTask, updateContingency, updateIncludeWeekends, addBucket, updateBucket, deleteBucket, moveBucket, addTask, createTaskFull, moveTask, deleteTask, updateProjectName, deleteProject, setBaseline, clearBaseline, refetch: fetchAll, refreshSchedule, profiles, toOwner, updateCharter, goals, addGoal, updateGoal, deleteGoal, criticalTaskIds, slackDays };
}
