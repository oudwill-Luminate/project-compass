import { parseISO, eachDayOfInterval, format, addDays } from 'date-fns';
import { Task } from '@/types/project';
import { CriticalPathResult } from './criticalPath';

export interface LevelingProposal {
  taskId: string;
  taskTitle: string;
  ownerName: string;
  oldStart: string;
  oldEnd: string;
  newStart: string;
  newEnd: string;
  shiftDays: number;
}

/**
 * Greedy resource-leveling algorithm.
 * For each owner, finds over-allocated days (>8h) and proposes shifting
 * non-critical tasks forward within their available slack.
 */
export function computeLevelingSuggestions(
  allTasks: Task[],
  criticalPath: CriticalPathResult
): LevelingProposal[] {
  const { criticalTaskIds, slackDays } = criticalPath;

  // Only leaf tasks with effort
  const leafTasks = allTasks.filter(t => t.subTasks.length === 0 && t.effortHours > 0);

  // Group by owner
  const tasksByOwner = new Map<string, Task[]>();
  for (const task of leafTasks) {
    if (task.owner.id === 'unknown') continue;
    const list = tasksByOwner.get(task.owner.id) || [];
    list.push(task);
    tasksByOwner.set(task.owner.id, list);
  }

  const proposals: LevelingProposal[] = [];
  // Track already-proposed shifts so we don't double-move
  const shiftedTasks = new Map<string, { newStart: string; newEnd: string }>();

  for (const [, ownerTasks] of tasksByOwner) {
    // Build mutable daily load map
    const dailyLoad = new Map<string, number>();

    const getTaskDates = (task: Task) => {
      const shifted = shiftedTasks.get(task.id);
      return shifted
        ? { start: shifted.newStart, end: shifted.newEnd }
        : { start: task.startDate, end: task.endDate };
    };

    const addTaskToLoad = (task: Task) => {
      const { start, end } = getTaskDates(task);
      try {
        const days = eachDayOfInterval({ start: parseISO(start), end: parseISO(end) });
        const hoursPerDay = days.length > 0 ? task.effortHours / days.length : 0;
        for (const day of days) {
          const key = format(day, 'yyyy-MM-dd');
          dailyLoad.set(key, (dailyLoad.get(key) || 0) + hoursPerDay);
        }
      } catch {
        // skip invalid dates
      }
    };

    const removeTaskFromLoad = (task: Task) => {
      const { start, end } = getTaskDates(task);
      try {
        const days = eachDayOfInterval({ start: parseISO(start), end: parseISO(end) });
        const hoursPerDay = days.length > 0 ? task.effortHours / days.length : 0;
        for (const day of days) {
          const key = format(day, 'yyyy-MM-dd');
          dailyLoad.set(key, (dailyLoad.get(key) || 0) - hoursPerDay);
        }
      } catch {
        // skip
      }
    };

    // Initialize daily load
    for (const task of ownerTasks) {
      addTaskToLoad(task);
    }

    // Find overloaded dates, sorted chronologically
    const getOverloadedDates = () =>
      Array.from(dailyLoad.entries())
        .filter(([, hours]) => hours > 8.001)
        .sort((a, b) => a[0].localeCompare(b[0]));

    let overloadedDates = getOverloadedDates();

    for (const [dateKey] of overloadedDates) {
      const currentLoad = dailyLoad.get(dateKey) || 0;
      if (currentLoad <= 8.001) continue; // already resolved by prior shift

      let excess = currentLoad - 8;

      // Find candidate tasks on this day: non-critical, with slack, on this date
      const candidates = ownerTasks
        .filter(task => {
          if (criticalTaskIds.has(task.id)) return false;
          const slack = slackDays.get(task.id) || 0;
          if (slack <= 0) return false;
          if (shiftedTasks.has(task.id)) return false; // already shifted
          const { start, end } = getTaskDates(task);
          return dateKey >= start && dateKey <= end;
        })
        .sort((a, b) => (slackDays.get(b.id) || 0) - (slackDays.get(a.id) || 0));

      for (const candidate of candidates) {
        if (excess <= 0) break;

        const { start, end } = getTaskDates(candidate);
        try {
          const days = eachDayOfInterval({ start: parseISO(start), end: parseISO(end) });
          const hoursPerDay = days.length > 0 ? candidate.effortHours / days.length : 0;
          if (hoursPerDay <= 0) continue;

          const slack = slackDays.get(candidate.id) || 0;
          const neededShift = Math.ceil(excess / hoursPerDay);
          const shiftDays = Math.min(slack, Math.max(1, neededShift));

          // Remove old load
          removeTaskFromLoad(candidate);

          const newStart = format(addDays(parseISO(start), shiftDays), 'yyyy-MM-dd');
          const newEnd = format(addDays(parseISO(end), shiftDays), 'yyyy-MM-dd');
          shiftedTasks.set(candidate.id, { newStart, newEnd });

          // Add new load
          addTaskToLoad(candidate);

          excess -= hoursPerDay;

          proposals.push({
            taskId: candidate.id,
            taskTitle: candidate.title,
            ownerName: candidate.owner.name,
            oldStart: start,
            oldEnd: end,
            newStart,
            newEnd,
            shiftDays,
          });
        } catch {
          // skip
        }
      }
    }
  }

  return proposals;
}
