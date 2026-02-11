import { Task } from '@/types/project';

export type HealthStatus = 'green' | 'yellow' | 'red';

export interface ProjectHealth {
  schedule: HealthStatus;
  budget: HealthStatus;
  risk: HealthStatus;
}

/**
 * Schedule health based on on-time percentage and critical path stuck tasks.
 */
export function computeScheduleHealth(
  tasks: Task[],
  criticalTaskIds: Set<string>,
): HealthStatus {
  if (tasks.length === 0) return 'green';

  // Check if any critical-path task is stuck
  const criticalStuck = tasks.some(
    t => criticalTaskIds.has(t.id) && t.status === 'stuck',
  );
  if (criticalStuck) return 'red';

  // Compute on-time ratio
  let onTime = 0;
  for (const t of tasks) {
    if (t.baselineEndDate) {
      if (t.endDate <= t.baselineEndDate) onTime++;
    } else if (t.status === 'done' || t.status === 'working') {
      onTime++;
    }
  }

  const ratio = onTime / tasks.length;
  if (ratio >= 0.8) return 'green';
  if (ratio >= 0.5) return 'yellow';
  return 'red';
}

/**
 * Budget health based on actual vs estimated cost ratio.
 */
export function computeBudgetHealth(tasks: Task[]): HealthStatus {
  let totalEstimated = 0;
  let totalActual = 0;

  for (const t of tasks) {
    totalEstimated += t.estimatedCost;
    totalActual += t.actualCost;
  }

  if (totalEstimated === 0) return 'green';

  const ratio = totalActual / totalEstimated;
  if (ratio <= 0.9) return 'green';
  if (ratio <= 1.0) return 'yellow';
  return 'red';
}

/**
 * Risk health based on flagged risk scores (impact * probability).
 */
export function computeRiskHealth(tasks: Task[]): HealthStatus {
  const flagged = tasks.filter(t => t.flaggedAsRisk);
  if (flagged.length === 0) return 'green';

  const scores = flagged.map(t => t.riskImpact * t.riskProbability);
  const maxScore = Math.max(...scores);

  if (maxScore >= 16 || flagged.length > 3) return 'red';
  if (scores.some(s => s >= 9)) return 'yellow';
  return 'green';
}

export function computeProjectHealth(
  tasks: Task[],
  criticalTaskIds: Set<string>,
): ProjectHealth {
  return {
    schedule: computeScheduleHealth(tasks, criticalTaskIds),
    budget: computeBudgetHealth(tasks),
    risk: computeRiskHealth(tasks),
  };
}
