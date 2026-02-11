import React, { createContext, useContext, useState, useCallback } from 'react';
import { Project, Task } from '@/types/project';
import { mockProject } from '@/data/mockData';
import { differenceInDays, parseISO, addDays, format } from 'date-fns';

type ViewType = 'table' | 'timeline' | 'risk';

interface ProjectContextType {
  project: Project;
  activeView: ViewType;
  setActiveView: (view: ViewType) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  toggleBucket: (bucketId: string) => void;
  updateContingency: (percent: number) => void;
  getAllTasks: () => Task[];
  getTaskById: (taskId: string) => Task | undefined;
}

const ProjectContext = createContext<ProjectContextType | null>(null);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [project, setProject] = useState<Project>(mockProject);
  const [activeView, setActiveView] = useState<ViewType>('table');

  const getAllTasks = useCallback(() => {
    return project.buckets.flatMap(b => b.tasks);
  }, [project]);

  const getTaskById = useCallback((taskId: string) => {
    return getAllTasks().find(t => t.id === taskId);
  }, [getAllTasks]);

  const autoScheduleDependents = useCallback((proj: Project, changedTaskId: string, daysDelta: number): Project => {
    if (daysDelta === 0) return proj;

    const allTasks = proj.buckets.flatMap(b => b.tasks);
    const visited = new Set<string>();

    const shiftDependents = (taskId: string, delta: number) => {
      if (visited.has(taskId)) return;
      visited.add(taskId);

      const dependents = allTasks.filter(t => t.dependsOn === taskId);
      for (const dep of dependents) {
        const start = parseISO(dep.startDate);
        const end = parseISO(dep.endDate);
        dep.startDate = format(addDays(start, delta), 'yyyy-MM-dd');
        dep.endDate = format(addDays(end, delta), 'yyyy-MM-dd');
        shiftDependents(dep.id, delta);
      }
    };

    shiftDependents(changedTaskId, daysDelta);
    return proj;
  }, []);

  const updateTask = useCallback((taskId: string, updates: Partial<Task>) => {
    setProject(prev => {
      const newProject = JSON.parse(JSON.stringify(prev)) as Project;

      for (const bucket of newProject.buckets) {
        const taskIndex = bucket.tasks.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
          const oldTask = bucket.tasks[taskIndex];

          if (updates.endDate && updates.endDate !== oldTask.endDate) {
            const daysDelta = differenceInDays(
              parseISO(updates.endDate),
              parseISO(oldTask.endDate)
            );
            bucket.tasks[taskIndex] = { ...oldTask, ...updates };
            autoScheduleDependents(newProject, taskId, daysDelta);
          } else if (updates.startDate && updates.startDate !== oldTask.startDate) {
            const daysDelta = differenceInDays(
              parseISO(updates.startDate),
              parseISO(oldTask.startDate)
            );
            const duration = differenceInDays(parseISO(oldTask.endDate), parseISO(oldTask.startDate));
            const newEnd = format(addDays(parseISO(updates.startDate), duration), 'yyyy-MM-dd');
            bucket.tasks[taskIndex] = { ...oldTask, ...updates, endDate: newEnd };
            autoScheduleDependents(newProject, taskId, daysDelta);
          } else {
            bucket.tasks[taskIndex] = { ...oldTask, ...updates };
          }
          break;
        }
      }

      return newProject;
    });
  }, [autoScheduleDependents]);

  const toggleBucket = useCallback((bucketId: string) => {
    setProject(prev => ({
      ...prev,
      buckets: prev.buckets.map(b =>
        b.id === bucketId ? { ...b, collapsed: !b.collapsed } : b
      ),
    }));
  }, []);

  const updateContingency = useCallback((percent: number) => {
    setProject(prev => ({ ...prev, contingencyPercent: percent }));
  }, []);

  return (
    <ProjectContext.Provider
      value={{
        project,
        activeView,
        setActiveView,
        updateTask,
        toggleBucket,
        updateContingency,
        getAllTasks,
        getTaskById,
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
