import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Project, Bucket, Task, Owner, DependencyType } from '@/types/project';
import { useAuth } from '@/context/AuthContext';
import { differenceInDays, parseISO, addDays, format } from 'date-fns';

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
}

const COLORS = ['#0073EA', '#00C875', '#A25DDC', '#FDAB3D', '#E2445C', '#579BFC', '#FF642E'];

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

    // Fetch project, buckets, tasks, members, and profiles in parallel
    const [projRes, bucketsRes, tasksRes, membersRes] = await Promise.all([
      supabase.from('projects').select('*').eq('id', projectId).single(),
      supabase.from('buckets').select('*').eq('project_id', projectId).order('position'),
      supabase.from('tasks').select('*').eq('bucket_id', projectId), // will be filtered below
      supabase.from('project_members').select('*').eq('project_id', projectId),
    ]);

    if (projRes.error || !projRes.data) {
      setLoading(false);
      return;
    }

    const projData = projRes.data as any;
    const bucketRows = (bucketsRes.data || []) as BucketRow[];
    const bucketIds = bucketRows.map(b => b.id);

    // Now fetch tasks for these buckets
    let taskRows: TaskRow[] = [];
    if (bucketIds.length > 0) {
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .in('bucket_id', bucketIds)
        .order('position');
      taskRows = (data || []) as TaskRow[];
    }

    // Fetch profiles for all referenced users
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

    // Build project structure
    const buckets: Bucket[] = bucketRows.map(b => ({
      id: b.id,
      name: b.name,
      color: b.color,
      collapsed: false,
      tasks: taskRows
        .filter(t => t.bucket_id === b.id)
        .map(t => {
          const ownerId = t.owner_id;
          const ownerProfile = ownerId && profileMap[ownerId];
          const idx = ownerId ? Object.keys(profileMap).indexOf(ownerId) : 0;
          return {
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
          };
        }),
    }));

    const proj: Project = {
      id: projData.id,
      name: projData.name,
      contingencyPercent: Number(projData.contingency_percent),
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

  // Realtime subscriptions
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

    // Map frontend fields to DB columns
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

    // Handle auto-scheduling for date changes
    const allTasks = project.buckets.flatMap(b => b.tasks);
    const oldTask = allTasks.find(t => t.id === taskId);

    if (oldTask) {
      let daysDelta = 0;

      if (updates.endDate && updates.endDate !== oldTask.endDate) {
        daysDelta = differenceInDays(parseISO(updates.endDate), parseISO(oldTask.endDate));
      } else if (updates.startDate && updates.startDate !== oldTask.startDate) {
        daysDelta = differenceInDays(parseISO(updates.startDate), parseISO(oldTask.startDate));
        // Also shift end date to maintain duration
        const duration = differenceInDays(parseISO(oldTask.endDate), parseISO(oldTask.startDate));
        dbUpdates.end_date = format(addDays(parseISO(updates.startDate), duration), 'yyyy-MM-dd');
      }

      // Update the main task
      await supabase.from('tasks').update(dbUpdates).eq('id', taskId);

      // Auto-schedule dependents
      if (daysDelta !== 0) {
        const visited = new Set<string>();
        const shiftDependents = async (parentId: string, delta: number) => {
          if (visited.has(parentId)) return;
          visited.add(parentId);
          const dependents = allTasks.filter(t => t.dependsOn === parentId);
          for (const dep of dependents) {
            const newStart = format(addDays(parseISO(dep.startDate), delta), 'yyyy-MM-dd');
            const newEnd = format(addDays(parseISO(dep.endDate), delta), 'yyyy-MM-dd');
            await supabase.from('tasks').update({ start_date: newStart, end_date: newEnd }).eq('id', dep.id);
            await shiftDependents(dep.id, delta);
          }
        };
        await shiftDependents(taskId, daysDelta);
      }
    } else {
      await supabase.from('tasks').update(dbUpdates).eq('id', taskId);
    }
  }, [project]);

  const updateContingency = useCallback(async (percent: number) => {
    if (!projectId) return;
    await supabase.from('projects').update({ contingency_percent: percent }).eq('id', projectId);
  }, [projectId]);

  const addBucket = useCallback(async (name: string) => {
    if (!projectId) return;
    const position = project?.buckets.length ?? 0;
    const color = COLORS[position % COLORS.length];
    const { error } = await supabase.from('buckets').insert({ project_id: projectId, name, color, position });
    if (error) console.error('addBucket error:', error);
  }, [projectId, project]);

  const updateBucket = useCallback(async (bucketId: string, updates: { name?: string; color?: string }) => {
    const { error } = await supabase.from('buckets').update(updates).eq('id', bucketId);
    if (error) console.error('updateBucket error:', error);
  }, []);

  const deleteBucket = useCallback(async (bucketId: string) => {
    // Delete all tasks in the bucket first
    await supabase.from('tasks').delete().eq('bucket_id', bucketId);
    const { error } = await supabase.from('buckets').delete().eq('id', bucketId);
    if (error) console.error('deleteBucket error:', error);
  }, []);

  const addTask = useCallback(async (bucketId: string, title: string) => {
    if (!user) return;
    const bucket = project?.buckets.find(b => b.id === bucketId);
    const position = bucket?.tasks.length ?? 0;
    const today = format(new Date(), 'yyyy-MM-dd');
    const endDate = format(addDays(new Date(), 7), 'yyyy-MM-dd');
    await supabase.from('tasks').insert({
      bucket_id: bucketId,
      title,
      position,
      owner_id: user.id,
      start_date: today,
      end_date: endDate,
    });
  }, [user, project]);

  const moveTask = useCallback(async (taskId: string, newBucketId: string, newPosition: number) => {
    const { error } = await supabase.from('tasks').update({ bucket_id: newBucketId, position: newPosition }).eq('id', taskId);
    if (error) console.error('moveTask error:', error);
    else await fetchAll(); // Force refresh after move
  }, [fetchAll]);

  const deleteTask = useCallback(async (taskId: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) console.error('deleteTask error:', error);
  }, []);

  return { project, members, loading, updateTask, updateContingency, addBucket, updateBucket, deleteBucket, addTask, moveTask, deleteTask, refetch: fetchAll, profiles, toOwner };
}
