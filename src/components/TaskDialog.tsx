import { useState, useEffect, useMemo } from 'react';
import { format, parseISO, differenceInDays, addDays } from 'date-fns';
import { CalendarIcon, AlertTriangle } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { TaskChecklist, ChecklistItem } from '@/components/TaskChecklist';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Task, TaskStatus, TaskPriority, DependencyType, STATUS_CONFIG, PRIORITY_CONFIG } from '@/types/project';
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
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';

const RISK_IMPACT_LABELS: Record<number, string> = {
  1: 'Negligible',
  2: 'Minor',
  3: 'Moderate',
  4: 'Major',
  5: 'Severe',
};

const RISK_PROBABILITY_LABELS: Record<number, string> = {
  1: 'Rare',
  2: 'Unlikely',
  3: 'Possible',
  4: 'Likely',
  5: 'Almost Certain',
};

const DEPENDENCY_LABELS: Record<DependencyType, string> = {
  'FS': 'Finish-to-Start',
  'FF': 'Finish-to-Finish',
  'SS': 'Start-to-Start',
  'SF': 'Start-to-Finish',
};

interface TaskDialogProps {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isNew?: boolean;
  onCreateSave?: (data: Omit<Task, 'id' | 'subTasks'>) => void;
}

export function TaskDialog({ task, open, onOpenChange, isNew, onCreateSave }: TaskDialogProps) {
  const { updateTask, getAllTasks, members } = useProject();
  const [formData, setFormData] = useState<Task>({ ...task });
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);

  useEffect(() => {
    if (open) {
      setFormData({ ...task });
      // Fetch checklist items
      if (!isNew) {
        supabase
          .from('checklist_items' as any)
          .select('*')
          .eq('task_id', task.id)
          .order('position')
          .then(({ data }) => {
            if (data) {
              setChecklistItems((data as any[]).map(d => ({
                id: d.id, label: d.label, checked: d.checked, position: d.position
              })));
            }
          });
      } else {
        setChecklistItems([]);
      }
    }
  }, [open, task, isNew]);

  const duration = useMemo(() => {
    try {
      return differenceInDays(parseISO(formData.endDate), parseISO(formData.startDate));
    } catch { return 0; }
  }, [formData.startDate, formData.endDate]);

  const [durationInput, setDurationInput] = useState<string>('');

  useEffect(() => {
    setDurationInput(String(duration));
  }, [duration]);

  const handleDurationChange = (val: string) => {
    setDurationInput(val);
    const days = parseInt(val, 10);
    if (!isNaN(days) && days > 0) {
      const newEnd = format(addDays(parseISO(formData.startDate), days), 'yyyy-MM-dd');
      setFormData(prev => ({ ...prev, endDate: newEnd }));
    }
  };

  const handleSave = async () => {
    // Completion guard: check all checklist items
    if (checklistItems.length > 0 && (formData.status === 'done' || formData.progress === 100)) {
      const unchecked = checklistItems.filter(i => !i.checked).length;
      if (unchecked > 0) {
        toast({ title: 'Cannot mark as complete', description: `${unchecked} checklist item${unchecked > 1 ? 's are' : ' is'} not done`, variant: 'destructive' });
        return;
      }
    }

    if (isNew && onCreateSave) {
      const { id, subTasks, ...rest } = formData;
      // For new tasks, we'll need to save checklist items after the task is created
      onCreateSave(rest);
    } else {
      updateTask(task.id, formData);
    }
    onOpenChange(false);
  };

  const otherTasks = getAllTasks().filter(t => t.id !== task.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] bg-background max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">{isNew ? 'New Task' : 'Edit Task'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Title */}
          <div>
            <Label className="text-xs font-medium">Title</Label>
            <Input
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              className="mt-1"
            />
          </div>

          {/* Status & Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-medium">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v: TaskStatus) => {
                  const progress = v === 'done' ? 100 : v === 'working' ? (formData.progress || 0) : 0;
                  setFormData({ ...formData, status: v, progress });
                }}
              >
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
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
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover">
                  {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Progress - only when status is "working" */}
          {formData.status === 'working' && (
            <div>
              <Label className="text-xs font-medium">Progress ({formData.progress || 0}%)</Label>
              <Slider
                value={[formData.progress || 0]}
                onValueChange={([v]) => setFormData({ ...formData, progress: v })}
                max={100}
                step={5}
                className="mt-2"
              />
            </div>
          )}

          {/* Owner */}
          <div>
            <Label className="text-xs font-medium">Owner</Label>
            <Select
              value={formData.owner?.id || 'unknown'}
              onValueChange={(v) => {
                const member = members.find(m => m.user_id === v);
                if (member) {
                  setFormData({
                    ...formData,
                    owner: { id: member.user_id, name: member.profile?.display_name || 'Unknown', color: '#0073EA' },
                  });
                } else {
                  setFormData({
                    ...formData,
                    owner: { id: 'unknown', name: 'Unassigned', color: '#999' },
                  });
                }
              }}
            >
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="unknown">Unassigned</SelectItem>
                {members.map(m => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.profile?.display_name || 'Unknown'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dates & Duration */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-medium">Expected Start</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal mt-1 text-xs")}>
                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                    {format(parseISO(formData.startDate), 'MMM dd, yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={parseISO(formData.startDate)}
                    onSelect={date => {
                      if (!date) return;
                      const newStart = format(date, 'yyyy-MM-dd');
                      const dur = differenceInDays(parseISO(formData.endDate), parseISO(formData.startDate));
                      const newEnd = format(addDays(date, Math.max(dur, 1)), 'yyyy-MM-dd');
                      setFormData({ ...formData, startDate: newStart, endDate: newEnd });
                    }}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="text-xs font-medium">Expected Finish</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal mt-1 text-xs")}>
                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
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
            <div>
              <Label className="text-xs font-medium">Duration (days)</Label>
              <Input
                type="number"
                min={1}
                value={durationInput}
                onChange={e => handleDurationChange(e.target.value)}
                className="mt-1 text-xs"
              />
            </div>
          </div>

          {/* Responsible */}
          <div>
            <Label className="text-xs font-medium">Responsible</Label>
            <Input
              value={formData.responsible || ''}
              onChange={e => setFormData({ ...formData, responsible: e.target.value || null })}
              placeholder="e.g. contractor or vendor name"
              className="mt-1"
            />
          </div>

          {/* Costs & Effort */}
          <div className="grid grid-cols-3 gap-4">
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
            <div>
              <Label className="text-xs font-medium">Effort Hours</Label>
              <Input
                type="number"
                min={0}
                step={0.5}
                value={formData.effortHours}
                onChange={e => setFormData({ ...formData, effortHours: Number(e.target.value) })}
                className="mt-1"
              />
            </div>
          </div>

          {/* Dependencies */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-medium">Depends On</Label>
              <Select
                value={formData.dependsOn || 'none'}
                onValueChange={v => {
                  const newDep = v === 'none' ? null : v;
                  if (newDep) {
                    // Circular dependency detection with path
                    const allTasks = getAllTasks();
                    const chain: string[] = [task.id];
                    const visited = new Set<string>([task.id]);
                    let current: string | null = newDep;
                    let circular = false;
                    while (current) {
                      chain.push(current);
                      if (current === task.id) { circular = true; break; }
                      if (visited.has(current)) break;
                      visited.add(current);
                      const t = allTasks.find(t => t.id === current);
                      current = t?.dependsOn || null;
                    }
                    if (circular) {
                      const names = chain.map(id => allTasks.find(t => t.id === id)?.title || 'Unknown').join(' → ');
                      toast({ title: 'Circular Dependency', description: names, variant: 'destructive' });
                      return;
                    }
                  }
                  setFormData({ ...formData, dependsOn: newDep });
                }}
              >
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="none">None</SelectItem>
                  {otherTasks.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium">Dependency Type</Label>
              <Select
                value={formData.dependencyType}
                onValueChange={(v: DependencyType) => setFormData({ ...formData, dependencyType: v })}
                disabled={!formData.dependsOn}
              >
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover">
                  {Object.entries(DEPENDENCY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Contingency Buffer */}
          <div className="p-3 rounded-lg border space-y-3">
            <div>
              <Label className="text-xs font-medium">Contingency Buffer (days)</Label>
              <Input
                type="number"
                min={0}
                value={formData.bufferDays}
                onChange={e => setFormData({ ...formData, bufferDays: Math.max(0, Number(e.target.value)) })}
                className="mt-1 w-32"
              />
            </div>
            {formData.bufferDays > 0 && (
              <div>
                <Label className="text-xs font-medium">Buffer Position</Label>
                <Select
                  value={formData.bufferPosition}
                  onValueChange={(v: 'start' | 'end') => setFormData({ ...formData, bufferPosition: v })}
                >
                  <SelectTrigger className="mt-1 w-40"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="end">After task (end)</SelectItem>
                    <SelectItem value="start">Before task (start)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Quality Checklist */}
          {!isNew && (
            <TaskChecklist
              taskId={task.id}
              items={checklistItems}
              onItemsChange={setChecklistItems}
            />
          )}

          {/* Risk Flag Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="flex items-center gap-2">
              <AlertTriangle className={cn("w-4 h-4", formData.flaggedAsRisk ? "text-destructive" : "text-muted-foreground")} />
              <div>
                <Label className="text-xs font-medium">Flag as Risk</Label>
                <p className="text-[10px] text-muted-foreground">Adds task to Risk Registry</p>
              </div>
            </div>
            <Switch
              checked={formData.flaggedAsRisk}
              onCheckedChange={checked => setFormData({
                ...formData,
                flaggedAsRisk: checked,
                riskImpact: checked ? (formData.riskImpact || 3) : 1,
                riskProbability: checked ? (formData.riskProbability || 3) : 1,
              })}
            />
          </div>

          {/* Risk Details */}
          {formData.flaggedAsRisk && (
            <div className="space-y-3 p-3 rounded-lg bg-destructive/5 border border-destructive/10">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium">Risk Impact</Label>
                  <Select
                    value={String(formData.riskImpact)}
                    onValueChange={v => setFormData({ ...formData, riskImpact: Number(v) })}
                  >
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-popover">
                      {[1, 2, 3, 4, 5].map(n => (
                        <SelectItem key={n} value={String(n)}>{n} — {RISK_IMPACT_LABELS[n]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium">Risk Probability</Label>
                  <Select
                    value={String(formData.riskProbability)}
                    onValueChange={v => setFormData({ ...formData, riskProbability: Number(v) })}
                  >
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-popover">
                      {[1, 2, 3, 4, 5].map(n => (
                        <SelectItem key={n} value={String(n)}>{n} — {RISK_PROBABILITY_LABELS[n]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs font-medium">Risk Description</Label>
                <Textarea
                  value={formData.riskDescription || ''}
                  onChange={e => setFormData({ ...formData, riskDescription: e.target.value })}
                  placeholder="Describe the risk impact and mitigation strategy..."
                  className="mt-1 min-h-[60px] text-xs"
                />
              </div>
              <div>
                <Label className="text-xs font-medium">Realized Mitigation Cost ($)</Label>
                <Input
                  type="number"
                  min={0}
                  value={formData.realizedCost || 0}
                  onChange={e => setFormData({ ...formData, realizedCost: Number(e.target.value) })}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave}>{isNew ? 'Create Task' : 'Save Changes'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
