import React, { createContext, useContext, useState, useCallback } from 'react';
import { Project, Task, ProjectGoal } from '@/types/project';
import { useProjectData, flattenTasks } from '@/hooks/useProjectData';

type ViewType = 'overview' | 'table' | 'timeline' | 'risk' | 'workload' | 'stakeholders' | 'activity' | 'settings';

interface ProjectContextType {
  project: Project;
  activeView: ViewType;
  setActiveView: (view: ViewType) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  toggleBucket: (bucketId: string) => void;
  updateContingency: (percent: number) => void;
  updateIncludeWeekends: (value: boolean) => void;
  updateProjectName: (name: string) => void;
  deleteProject: () => Promise<void>;
  addBucket: (name: string) => void;
  updateBucket: (bucketId: string, updates: { name?: string; color?: string; description?: string; owner_id?: string | null }) => void;
  deleteBucket: (bucketId: string) => void;
  moveBucket: (bucketId: string, newPosition: number) => void;
  addTask: (bucketId: string, title: string, parentTaskId?: string) => void;
  createTaskFull: (bucketId: string, taskData: Omit<Task, 'id' | 'subTasks'>) => void;
  moveTask: (taskId: string, newBucketId: string, newPosition: number) => void;
  deleteTask: (taskId: string) => void;
  getAllTasks: () => Task[];
  getTaskById: (taskId: string) => Task | undefined;
  setBaseline: () => Promise<void>;
  clearBaseline: () => Promise<void>;
  updateCharter: (markdown: string) => Promise<void>;
  goals: ProjectGoal[];
  addGoal: (title: string) => Promise<void>;
  updateGoal: (goalId: string, updates: Partial<ProjectGoal>) => Promise<void>;
  deleteGoal: (goalId: string) => Promise<void>;
  loading: boolean;
  members: { id: string; user_id: string; role: string; profile: any }[];
  criticalTaskIds: Set<string>;
  slackDays: Map<string, number>;
  refreshSchedule: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | null>(null);

export function ProjectProvider({ projectId, children }: { projectId: string; children: React.ReactNode }) {
  const { project, members, loading, updateTask: dbUpdateTask, updateContingency: dbUpdateContingency, updateIncludeWeekends: dbUpdateIncludeWeekends, updateProjectName: dbUpdateProjectName, deleteProject: dbDeleteProject, addBucket: dbAddBucket, updateBucket: dbUpdateBucket, deleteBucket: dbDeleteBucket, moveBucket: dbMoveBucket, addTask: dbAddTask, createTaskFull: dbCreateTaskFull, moveTask: dbMoveTask, deleteTask: dbDeleteTask, setBaseline: dbSetBaseline, clearBaseline: dbClearBaseline, updateCharter: dbUpdateCharter, goals, addGoal: dbAddGoal, updateGoal: dbUpdateGoal, deleteGoal: dbDeleteGoal, criticalTaskIds, slackDays, refetch } = useProjectData(projectId);
  const [activeView, setActiveView] = useState<ViewType>('table');
  const [collapsedBuckets, setCollapsedBuckets] = useState<Set<string>>(new Set());

  // Build project with collapsed state
  const projectWithCollapsed: Project = project
    ? {
        ...project,
        buckets: project.buckets.map(b => ({
          ...b,
          collapsed: collapsedBuckets.has(b.id),
        })),
      }
    : { id: '', name: '', contingencyPercent: 10, includeWeekends: false, charterMarkdown: '', buckets: [] };

  const getAllTasks = useCallback(() => {
    return projectWithCollapsed.buckets.flatMap(b => flattenTasks(b.tasks));
  }, [projectWithCollapsed]);

  const getTaskById = useCallback((taskId: string) => {
    return getAllTasks().find(t => t.id === taskId);
  }, [getAllTasks]);

  const updateTask = useCallback((taskId: string, updates: Partial<Task>) => {
    dbUpdateTask(taskId, updates);
  }, [dbUpdateTask]);

  const toggleBucket = useCallback((bucketId: string) => {
    setCollapsedBuckets(prev => {
      const next = new Set(prev);
      if (next.has(bucketId)) next.delete(bucketId);
      else next.add(bucketId);
      return next;
    });
  }, []);

  const updateContingency = useCallback((percent: number) => {
    dbUpdateContingency(percent);
  }, [dbUpdateContingency]);

  return (
    <ProjectContext.Provider
      value={{
        project: projectWithCollapsed,
        activeView,
        setActiveView,
        updateTask,
        toggleBucket,
        updateContingency,
        updateIncludeWeekends: dbUpdateIncludeWeekends,
        updateProjectName: dbUpdateProjectName,
        deleteProject: dbDeleteProject,
        addBucket: dbAddBucket,
        updateBucket: dbUpdateBucket,
        deleteBucket: dbDeleteBucket,
        moveBucket: dbMoveBucket,
        addTask: dbAddTask,
        createTaskFull: dbCreateTaskFull,
        moveTask: dbMoveTask,
        deleteTask: dbDeleteTask,
        getAllTasks,
        getTaskById,
        setBaseline: dbSetBaseline,
        clearBaseline: dbClearBaseline,
        updateCharter: dbUpdateCharter,
        goals,
        addGoal: dbAddGoal,
        updateGoal: dbUpdateGoal,
        deleteGoal: dbDeleteGoal,
        loading,
        members,
        criticalTaskIds,
        slackDays,
        refreshSchedule: refetch,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) throw new Error('useProject must be used within ProjectProvider');
  return context;
}
