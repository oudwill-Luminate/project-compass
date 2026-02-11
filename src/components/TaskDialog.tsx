import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Task, TaskStatus, TaskPriority, STATUS_CONFIG, PRIORITY_CONFIG } from '@/types/project';
import { useProject } from '@/context/ProjectContext';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface TaskDialogProps {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskDialog({ task, open, onOpenChange }: TaskDialogProps) {
  const { updateTask, getAllTasks } = useProject();
  const [formData, setFormData] = useState<Task>({ ...task });

  useEffect(() => {
    if (open) {
      setFormData({ ...task });
    }
  }, [open, task]);

  const handleSave = () => {
    updateTask(task.id, formData);
    onOpenChange(false);
  };

  const otherTasks = getAllTasks().filter(t => t.id !== task.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] bg-background">
        <DialogHeader>
          <DialogTitle className="text-lg">Edit Task</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-xs font-medium">Title</Label>
            <Input
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-medium">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v: TaskStatus) => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-medium">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(v: TaskPriority) => setFormData({ ...formData, priority: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-medium">Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal mt-1")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(parseISO(formData.startDate), 'MMM dd, yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={parseISO(formData.startDate)}
                    onSelect={date => date && setFormData({ ...formData, startDate: format(date, 'yyyy-MM-dd') })}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label className="text-xs font-medium">End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal mt-1")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(parseISO(formData.endDate), 'MMM dd, yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={parseISO(formData.endDate)}
                    onSelect={date => date && setFormData({ ...formData, endDate: format(date, 'yyyy-MM-dd') })}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-medium">Estimated Cost ($)</Label>
              <Input
                type="number"
                value={formData.estimatedCost}
                onChange={e => setFormData({ ...formData, estimatedCost: Number(e.target.value) })}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-medium">Actual Cost ($)</Label>
              <Input
                type="number"
                value={formData.actualCost}
                onChange={e => setFormData({ ...formData, actualCost: Number(e.target.value) })}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-medium">Depends On</Label>
            <Select
              value={formData.dependsOn || 'none'}
              onValueChange={v => setFormData({ ...formData, dependsOn: v === 'none' ? null : v })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="none">None</SelectItem>
                {otherTasks.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {formData.flaggedAsRisk && (
            <div className="grid grid-cols-2 gap-4 p-3 rounded-lg bg-destructive/5 border border-destructive/10">
              <div>
                <Label className="text-xs font-medium">Risk Impact (1-5)</Label>
                <Select
                  value={String(formData.riskImpact)}
                  onValueChange={v => setFormData({ ...formData, riskImpact: Number(v) })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    {[1, 2, 3, 4, 5].map(n => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-medium">Risk Probability (1-5)</Label>
                <Select
                  value={String(formData.riskProbability)}
                  onValueChange={v => setFormData({ ...formData, riskProbability: Number(v) })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    {[1, 2, 3, 4, 5].map(n => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save Changes</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
