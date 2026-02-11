import { useState } from 'react';
import { Task } from '@/types/project';
import { useProject } from '@/context/ProjectContext';
import { TaskDialog } from '@/components/TaskDialog';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '@/types/project';

interface TaskSearchCommandProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskSearchCommand({ open, onOpenChange }: TaskSearchCommandProps) {
  const { getAllTasks } = useProject();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const tasks = getAllTasks();

  const handleSelect = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      onOpenChange(false);
      setSelectedTask(task);
    }
  };

  return (
    <>
      <CommandDialog open={open} onOpenChange={onOpenChange}>
        <CommandInput placeholder="Search tasks by name..." />
        <CommandList>
          <CommandEmpty>No tasks found.</CommandEmpty>
          <CommandGroup heading="Tasks">
            {tasks.map(task => {
              const statusCfg = STATUS_CONFIG[task.status];
              const priorityCfg = PRIORITY_CONFIG[task.priority];
              return (
                <CommandItem
                  key={task.id}
                  value={task.title}
                  onSelect={() => handleSelect(task.id)}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="truncate">{task.title}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {statusCfg.label}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {priorityCfg.label}
                    </Badge>
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      {selectedTask && (
        <TaskDialog
          task={selectedTask}
          open={!!selectedTask}
          onOpenChange={(open) => { if (!open) setSelectedTask(null); }}
        />
      )}
    </>
  );
}
