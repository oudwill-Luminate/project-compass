import React, { createContext, useContext, useState, useCallback } from 'react';
import { Project, Task } from '@/types/project';
import { useProjectData, flattenTasks } from '@/hooks/useProjectData';

type ViewType = 'table' | 'timeline' | 'risk';

interface ProjectContextType {
  project: Project;
  activeView: ViewType;
  setActiveView: (view: ViewType) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  toggleBucket: (bucketId: string) => void;
  updateContingency: (percent: number) => void;
  addBucket: (name: string) => void;
  updateBucket: (bucketId: string, updates: { name?: string; color?: string; description?: string; owner_id?: string | null }) => void;
  deleteBucket: (bucketId: string) => void;
  addTask: (bucketId: string, title: string, parentTaskId?: string) => void;
  createTaskFull: (bucketId: string, taskData: Omit<Task, 'id' | 'subTasks'>) => void;
  moveTask: (taskId: string, newBucketId: string, newPosition: number) => void;
  deleteTask: (taskId: string) => void;
  getAllTasks: () => Task[];
  getTaskById: (taskId: string) => Task | undefined;
  loading: boolean;
  members: { id: string; user_id: string; role: string; profile: any }[];
}

const ProjectContext = createContext<ProjectContextType | null>(null);

export function ProjectProvider({ projectId, children }: { projectId: string; children: React.ReactNode }) {
  const { project, members, loading, updateTask: dbUpdateTask, updateContingency: dbUpdateContingency, addBucket: dbAddBucket, updateBucket: dbUpdateBucket, deleteBucket: dbDeleteBucket, addTask: dbAddTask, createTaskFull: dbCreateTaskFull, moveTask: dbMoveTask, deleteTask: dbDeleteTask } = useProjectData(projectId);
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
    : { id: '', name: '', contingencyPercent: 10, buckets: [] };

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
        addBucket: dbAddBucket,
        updateBucket: dbUpdateBucket,
        deleteBucket: dbDeleteBucket,
        addTask: dbAddTask,
        createTaskFull: dbCreateTaskFull,
        moveTask: dbMoveTask,
        deleteTask: dbDeleteTask,
        getAllTasks,
        getTaskById,
        loading,
        members,
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
