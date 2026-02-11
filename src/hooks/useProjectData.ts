import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Project, Bucket, Task, Owner, DependencyType } from '@/types/project';
import { useAuth } from '@/context/AuthContext';
import { differenceInDays, parseISO, addDays, format } from 'date-fns';
import { toast } from 'sonner';

interface ProfileRow {
  id: string;
  display_name: string;
  avatar_url: string | null;
  job_title: string;
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
}

const COLORS = ['#0073EA', '#00C875', '#A25DDC', '#FDAB3D', '#E2445C', '#579BFC', '#FF642E'];

function buildTaskTree(taskRows: TaskRow[], profileMap: Record<string, ProfileRow>): Task[] {
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
      estimatedCost: Number(t.estimated_cost),
      actualCost: Number(t.actual_cost),
      dependsOn: t.depends_on,
      dependencyType: (t.dependency_type || 'FS') as DependencyType,
      flaggedAsRisk: t.flagged_as_risk,
      riskImpact: t.risk_impact,
      riskProbability: t.risk_probability,
      riskDescription: t.risk_description || '',
      parentTaskId: t.parent_task_id,
      bufferDays: t.buffer_days || 0,
      bufferPosition: (t.buffer_position === 'start' ? 'start' : 'end') as 'start' | 'end',
      responsible: t.responsible || null,
      progress: t.progress || 0,
      effortHours: Number(t.effort_hours) || 0,
      baselineStartDate: t.baseline_start_date || null,
      baselineEndDate: t.baseline_end_date || null,
      subTasks: [],
    });
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

/** Detect circular dependency: walk the chain from proposedDependsOn and check if we reach taskId */
function detectCircularDependency(
  taskId: string,
  proposedDependsOn: string,
  allTasks: Task[]
): boolean {
  const visited = new Set<string>();
  let current: string | null = proposedDependsOn;
  while (current) {
    if (current === taskId) return true;
    if (visited.has(current)) break;
    visited.add(current);
    const task = allTasks.find(t => t.id === current);
    current = task?.dependsOn ?? null;
  }
  return false;
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
      tasks: buildTaskTree(taskRows.filter(t => t.bucket_id === b.id), profileMap),
    }));

    const proj: Project = {
      id: projData.id,
      name: projData.name,
      contingencyPercent: Number(projData.contingency_percent),
      includeWeekends: projData.include_weekends ?? false,
      buckets,
    };

    setProject(proj);
    setMembers(memberRows.map((m: any) => ({
      id: m.id,
      user_id: m.user_id,
      role: m.role,
      profile: profileMap[m.user_id] || { id: m.user_id, display_name: 'Unknown', avatar_url: null, job_title: '' },
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
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [projectId, fetchAll]);

  const updateTask = useCallback(async (taskId: string, updates: Partial<Task>) => {
    if (!project) return;

    const allTasks = project.buckets.flatMap(b => flattenTasks(b.tasks));
    const oldTask = allTasks.find(t => t.id === taskId);
    if (!oldTask) return;

    // If dependency link or type changed, auto-schedule this task's dates
    const dependencyChanged =
      (updates.dependsOn !== undefined && updates.dependsOn !== oldTask.dependsOn) ||
      (updates.dependencyType !== undefined && updates.dependencyType !== oldTask.dependencyType);

    if (dependencyChanged) {
      const predecessorId = updates.dependsOn !== undefined ? updates.dependsOn : oldTask.dependsOn;
      const depType = (updates.dependencyType !== undefined ? updates.dependencyType : oldTask.dependencyType) as DependencyType;

      if (predecessorId) {
        // Circular dependency check
        if (detectCircularDependency(taskId, predecessorId, allTasks)) {
          toast.error('Circular dependency detected. This dependency would create a loop.');
          return;
        }

        const predecessor = allTasks.find(t => t.id === predecessorId);
        if (predecessor) {
          const currentTask = {
            startDate: updates.startDate || oldTask.startDate,
            endDate: updates.endDate || oldTask.endDate,
          };
          const scheduled = scheduleTask(predecessor, currentTask, depType, project.includeWeekends);
          updates = { ...updates, startDate: scheduled.startDate, endDate: scheduled.endDate };
        }
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
    if (updates.responsible !== undefined) dbUpdates.responsible = updates.responsible;
    if (updates.progress !== undefined) dbUpdates.progress = updates.progress;
    if (updates.effortHours !== undefined) dbUpdates.effort_hours = updates.effortHours;
    if (updates.baselineStartDate !== undefined) dbUpdates.baseline_start_date = updates.baselineStartDate;
    if (updates.baselineEndDate !== undefined) dbUpdates.baseline_end_date = updates.baselineEndDate;
    if (updates.owner !== undefined) dbUpdates.owner_id = updates.owner.id === 'unknown' ? null : updates.owner.id;

    await supabase.from('tasks').update(dbUpdates).eq('id', taskId);

    // Cascade: reschedule all dependents using proper dependency-type math
    const updatedTask = { ...oldTask, ...updates };
    const visited = new Set<string>();

    const cascadeDependents = async (predecessorTask: Task) => {
      if (visited.has(predecessorTask.id)) return; // circular dependency prevention
      visited.add(predecessorTask.id);

      const dependents = allTasks.filter(t => t.dependsOn === predecessorTask.id);
      for (const dep of dependents) {
        const scheduled = scheduleTask(predecessorTask, dep, dep.dependencyType, project.includeWeekends);
        await supabase.from('tasks').update({
          start_date: scheduled.startDate,
          end_date: scheduled.endDate,
        }).eq('id', dep.id);

        // Continue cascading with the updated dependent
        const updatedDep = { ...dep, startDate: scheduled.startDate, endDate: scheduled.endDate };
        await cascadeDependents(updatedDep);
      }
    };

    // Only cascade if dates actually changed
    const datesChanged =
      (updates.startDate && updates.startDate !== oldTask.startDate) ||
      (updates.endDate && updates.endDate !== oldTask.endDate);

    if (datesChanged) {
      await cascadeDependents(updatedTask);
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
      flaggedAsRisk: false,
      bufferDays: 0,
      bufferPosition: 'end',
      responsible: null,
      progress: 0,
      effortHours: 0,
      riskImpact: 1,
      riskProbability: 1,
      riskDescription: '',
      parentTaskId: parentTaskId || null,
      baselineStartDate: null,
      baselineEndDate: null,
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

  return { project, members, loading, updateTask, updateContingency, updateIncludeWeekends, addBucket, updateBucket, deleteBucket, moveBucket, addTask, createTaskFull, moveTask, deleteTask, updateProjectName, deleteProject, setBaseline, clearBaseline, refetch: fetchAll, profiles, toOwner };
}
