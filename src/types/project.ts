export type TaskStatus = 'done' | 'working' | 'stuck' | 'not-started';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type DependencyType = 'FS' | 'FF' | 'SS' | 'SF';

export interface Owner {
  id: string;
  name: string;
  color: string;
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  owner: Owner;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  estimatedCost: number;
  actualCost: number;
  dependsOn: string | null;
  dependencyType: DependencyType;
  flaggedAsRisk: boolean;
  riskImpact: number; // 1-5
  riskProbability: number; // 1-5
  riskDescription: string;
  parentTaskId: string | null;
  bufferDays: number;
  bufferPosition: 'start' | 'end';
  responsible: string | null;
  progress: number; // 0-100
  baselineStartDate: string | null;
  baselineEndDate: string | null;
  subTasks: Task[];
}

export interface Bucket {
  id: string;
  name: string;
  color: string;
  description?: string;
  ownerId?: string | null;
  collapsed?: boolean;
  tasks: Task[];
}

export interface Project {
  id: string;
  name: string;
  contingencyPercent: number;
  includeWeekends: boolean;
  buckets: Bucket[];
}

export const STATUS_CONFIG: Record<TaskStatus, { label: string; colorVar: string }> = {
  'done': { label: 'Done', colorVar: 'status-done' },
  'working': { label: 'Working on it', colorVar: 'status-working' },
  'stuck': { label: 'Stuck', colorVar: 'status-stuck' },
  'not-started': { label: 'Not Started', colorVar: 'status-not-started' },
};

export const PRIORITY_CONFIG: Record<TaskPriority, { label: string; colorVar: string }> = {
  'critical': { label: 'Critical', colorVar: 'priority-critical' },
  'high': { label: 'High', colorVar: 'priority-high' },
  'medium': { label: 'Medium', colorVar: 'priority-medium' },
  'low': { label: 'Low', colorVar: 'priority-low' },
};
