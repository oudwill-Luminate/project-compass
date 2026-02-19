export type TaskStatus = 'done' | 'working' | 'stuck' | 'not-started';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type DependencyType = 'FS' | 'FF' | 'SS' | 'SF';
export type ScheduleConstraintType = 'ASAP' | 'SNET' | 'SNLT' | 'MSO' | 'MFO' | 'FNET' | 'FNLT';

export interface TaskDependency {
  predecessorId: string;
  type: DependencyType;
}

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
  /** @deprecated Use dependencies array instead */
  dependsOn: string | null;
  /** @deprecated Use dependencies array instead */
  dependencyType: DependencyType;
  dependencies: TaskDependency[];
  flaggedAsRisk: boolean;
  riskImpact: number; // 1-5
  riskProbability: number; // 1-5
  riskDescription: string;
  parentTaskId: string | null;
  bufferDays: number;
  bufferPosition: 'start' | 'end';
  isMilestone: boolean;
  responsible: string | null;
  progress: number; // 0-100
  effortHours: number;
  baselineStartDate: string | null;
  baselineEndDate: string | null;
  realizedCost: number;
  constraintType: ScheduleConstraintType;
  constraintDate: string | null;
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

export interface ProjectGoal {
  id: string;
  projectId: string;
  title: string;
  progress: number;
  position: number;
}

export interface Project {
  id: string;
  name: string;
  contingencyPercent: number;
  includeWeekends: boolean;
  charterMarkdown: string;
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

export const CONSTRAINT_CONFIG: Record<ScheduleConstraintType, { label: string; description: string }> = {
  'ASAP': { label: 'As Soon As Possible', description: 'Start date is fully driven by dependencies (default)' },
  'SNET': { label: 'Start No Earlier Than', description: 'Task cannot start before the constraint date' },
  'SNLT': { label: 'Start No Later Than', description: 'Task should start by the constraint date — warns if conflict' },
  'MSO': { label: 'Must Start On', description: 'Task is locked to start on the constraint date' },
  'MFO': { label: 'Must Finish On', description: 'Task is locked to finish on the constraint date' },
  'FNET': { label: 'Finish No Earlier Than', description: 'Task cannot finish before the constraint date' },
  'FNLT': { label: 'Finish No Later Than', description: 'Task should finish by the constraint date — warns if conflict' },
};
