import { useState, useEffect, useMemo } from 'react';
import { format, parseISO, differenceInDays, addDays } from 'date-fns';
import { CalendarIcon, AlertTriangle, Info, Diamond, Plus, X, Pin, HelpCircle, Ban } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { TaskChecklist, ChecklistItem } from '@/components/TaskChecklist';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Task, TaskStatus, TaskPriority, DependencyType, TaskDependency, ScheduleConstraintType, STATUS_CONFIG, PRIORITY_CONFIG, CONSTRAINT_CONFIG } from '@/types/project';
import { useProject } from '@/context/ProjectContext';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
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
  const { updateTask, getAllTasks, members, project } = useProject();
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
      if (project.includeWeekends) {
        return differenceInDays(parseISO(formData.endDate), parseISO(formData.startDate)) + 1;
      }
      let count = 0;
      let d = parseISO(formData.startDate);
      const end = parseISO(formData.endDate);
      while (d <= end) {
        if (d.getDay() !== 0 && d.getDay() !== 6) count++;
        d = addDays(d, 1);
      }
      return Math.max(count, 1);
    } catch { return 1; }
  }, [formData.startDate, formData.endDate, project.includeWeekends]);

  const [durationInput, setDurationInput] = useState<string>('');

  useEffect(() => {
    setDurationInput(String(duration));
  }, [duration]);

  const handleDurationChange = (val: string) => {
    setDurationInput(val);
    const days = parseInt(val, 10);
    if (!isNaN(days) && days > 0) {
      let newEnd: Date;
      if (project.includeWeekends) {
        newEnd = addDays(parseISO(formData.startDate), days - 1);
      } else {
        let remaining = days - 1;
        newEnd = parseISO(formData.startDate);
        while (remaining > 0) {
          newEnd = addDays(newEnd, 1);
          if (newEnd.getDay() !== 0 && newEnd.getDay() !== 6) remaining--;
        }
      }
      setFormData(prev => ({ ...prev, endDate: format(newEnd, 'yyyy-MM-dd') }));
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

    // Filter out empty dependency rows
    const cleanDeps = (formData.dependencies || []).filter(d => d.predecessorId);
    // Filter out empty exclusion links
    const cleanExclusions = (formData.exclusionLinks || []).filter(id => id);

    // Only include dependencies/exclusions in the update payload if they actually changed
    const depsChanged = JSON.stringify(cleanDeps) !== JSON.stringify(task.dependencies || []);
    const exclusionsChanged = JSON.stringify([...cleanExclusions].sort()) !== JSON.stringify([...(task.exclusionLinks || [])].sort());

    const cleanedFormData = {
      ...formData,
      ...(depsChanged
        ? {
            dependencies: cleanDeps,
            dependsOn: cleanDeps.length > 0 ? cleanDeps[0].predecessorId : null,
            dependencyType: cleanDeps.length > 0 ? cleanDeps[0].type : 'FS' as DependencyType,
          }
        : {}),
      ...(exclusionsChanged ? { exclusionLinks: cleanExclusions } : {}),
    };
    // Remove dependencies/exclusionLinks keys if they weren't changed so updateTask doesn't trigger rescheduling
    if (!depsChanged) {
      delete (cleanedFormData as any).dependencies;
      delete (cleanedFormData as any).dependsOn;
      delete (cleanedFormData as any).dependencyType;
    }
    if (!exclusionsChanged) {
      delete (cleanedFormData as any).exclusionLinks;
    }

    if (isNew && onCreateSave) {
      const { id, subTasks, ...rest } = cleanedFormData;
      onCreateSave(rest);
    } else {
      updateTask(task.id, cleanedFormData);
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

          {/* Milestone Toggle - only for leaf tasks */}
          {!(task.subTasks && task.subTasks.length > 0) && (
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <div className="flex items-center gap-2">
                <Diamond className="w-4 h-4 text-primary" fill="currentColor" />
                <div>
                  <Label className="text-xs font-medium">Milestone</Label>
                  {formData.isMilestone && (
                    <p className="text-[11px] text-muted-foreground">Zero-duration checkpoint</p>
                  )}
                </div>
              </div>
              <Switch
                checked={formData.isMilestone}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setFormData({ ...formData, isMilestone: true, endDate: formData.startDate });
                  } else {
                    setFormData({ ...formData, isMilestone: false });
                  }
                }}
              />
            </div>
          )}

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
          {task.subTasks && task.subTasks.length > 0 ? (() => {
            const subs = task.subTasks;
            const effectiveDates = subs.map(t => {
              const s = t.bufferDays > 0 && t.bufferPosition === 'start'
                ? format(addDays(parseISO(t.startDate), -t.bufferDays), 'yyyy-MM-dd')
                : t.startDate;
              const e = t.bufferDays > 0 && t.bufferPosition === 'end'
                ? format(addDays(parseISO(t.endDate), t.bufferDays), 'yyyy-MM-dd')
                : t.endDate;
              return { s, e };
            });
            const rolledStart = effectiveDates.reduce((min, d) => d.s < min ? d.s : min, effectiveDates[0].s);
            const rolledEnd = effectiveDates.reduce((max, d) => d.e > max ? d.e : max, effectiveDates[0].e);
            const rolledDuration = project.includeWeekends
              ? differenceInDays(parseISO(rolledEnd), parseISO(rolledStart)) + 1
              : (() => {
                  let count = 0;
                  let d = parseISO(rolledStart);
                  const end = parseISO(rolledEnd);
                  while (d <= end) {
                    if (d.getDay() !== 0 && d.getDay() !== 6) count++;
                    d = addDays(d, 1);
                  }
                  return Math.max(count, 1);
                })();
            return (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs font-medium">Expected Start</Label>
                    <Button variant="outline" disabled className="w-full justify-start text-left font-normal mt-1 text-xs">
                      <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                      {format(parseISO(rolledStart), 'MMM dd, yyyy')}
                    </Button>
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Expected Finish</Label>
                    <Button variant="outline" disabled className="w-full justify-start text-left font-normal mt-1 text-xs">
                      <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                      {format(parseISO(rolledEnd), 'MMM dd, yyyy')}
                    </Button>
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Duration (days)</Label>
                    <Input type="number" value={rolledDuration} disabled className="mt-1 text-xs" />
                  </div>
                </div>
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Info className="h-3 w-3" />
                  Auto-calculated from {subs.length} sub-task{subs.length > 1 ? 's' : ''}
                </p>
              </div>
            );
          })() : formData.isMilestone ? (
          <div>
            <Label className="text-xs font-medium">Milestone Date</Label>
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
                    const d = format(date, 'yyyy-MM-dd');
                    setFormData({ ...formData, startDate: d, endDate: d });
                  }}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
          ) : (
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
                      const newEnd = format(addDays(date, Math.max(dur, 0)), 'yyyy-MM-dd');
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
          )}

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
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Dependencies</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-xs gap-1"
                onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    dependencies: [...(prev.dependencies || []), { predecessorId: '', type: 'FS' as DependencyType }],
                  }));
                }}
              >
                <Plus className="w-3 h-3" /> Add
              </Button>
            </div>
            {(formData.dependencies || []).length === 0 && (
              <p className="text-xs text-muted-foreground">No dependencies. Click "Add" to link a predecessor.</p>
            )}
            {(formData.dependencies || []).map((dep, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_140px_28px] gap-2 items-center">
                <Select
                  value={dep.predecessorId || 'none'}
                  onValueChange={v => {
                    const newPredId = v === 'none' ? '' : v;
                    if (newPredId) {
                      // Quick circular check
                      const allTasks = getAllTasks();
                      const visited = new Set<string>([task.id]);
                      let current: string | null = newPredId;
                      let circular = false;
                      while (current) {
                        if (current === task.id) { circular = true; break; }
                        if (visited.has(current)) break;
                        visited.add(current);
                        const t = allTasks.find(t => t.id === current);
                        if (!t) break;
                        const tDeps = t.dependencies?.length > 0 ? t.dependencies : (t.dependsOn ? [{ predecessorId: t.dependsOn, type: t.dependencyType }] : []);
                        // Check all predecessors of this task
                        current = null;
                        for (const d of tDeps) {
                          if (d.predecessorId === task.id) { circular = true; break; }
                        }
                        if (circular) break;
                        current = tDeps.length > 0 ? tDeps[0].predecessorId : null;
                      }
                      if (circular) {
                        toast({ title: 'Circular Dependency', description: 'This would create a cycle', variant: 'destructive' });
                        return;
                      }
                    }
                    setFormData(prev => ({
                      ...prev,
                      dependencies: prev.dependencies.map((d, i) => i === idx ? { ...d, predecessorId: newPredId } : d),
                    }));
                  }}
                >
                  <SelectTrigger className="text-xs h-8"><SelectValue placeholder="Select task..." /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="none">None</SelectItem>
                    {otherTasks
                      .filter(t => !(formData.dependencies || []).some((d, i) => i !== idx && d.predecessorId === t.id))
                      .map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Select
                  value={dep.type}
                  onValueChange={(v: DependencyType) => {
                    setFormData(prev => ({
                      ...prev,
                      dependencies: prev.dependencies.map((d, i) => i === idx ? { ...d, type: v } : d),
                    }));
                  }}
                >
                  <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    {Object.entries(DEPENDENCY_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  onClick={() => {
                    setFormData(prev => ({
                      ...prev,
                      dependencies: prev.dependencies.filter((_, i) => i !== idx),
                    }));
                  }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Non-Overlap (Exclusion) Links */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ban className="w-4 h-4 text-orange-500" />
                <Label className="text-xs font-medium">Non-Overlap Links</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[280px] text-xs">
                      Tasks linked here cannot run at the same time (e.g. shared space or crew constraints). The scheduler will automatically sequence them.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-xs gap-1"
                onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    exclusionLinks: [...(prev.exclusionLinks || []), ''],
                  }));
                }}
              >
                <Plus className="w-3 h-3" /> Add
              </Button>
            </div>
            {(formData.exclusionLinks || []).length === 0 && (
              <p className="text-xs text-muted-foreground">No non-overlap links. Click "Add" to prevent overlap with another task.</p>
            )}
            {(formData.exclusionLinks || []).map((linkedId, idx) => {
              // Filter out: self, already-linked tasks, and dependency predecessors (already sequenced)
              const depPredIds = new Set((formData.dependencies || []).map(d => d.predecessorId));
              const alreadyLinked = new Set((formData.exclusionLinks || []).filter((_, i) => i !== idx));
              const available = otherTasks.filter(t => 
                !depPredIds.has(t.id) && !alreadyLinked.has(t.id)
              );
              return (
                <div key={idx} className="grid grid-cols-[1fr_28px] gap-2 items-center">
                  <Select
                    value={linkedId || 'none'}
                    onValueChange={v => {
                      const newId = v === 'none' ? '' : v;
                      setFormData(prev => ({
                        ...prev,
                        exclusionLinks: prev.exclusionLinks.map((id, i) => i === idx ? newId : id),
                      }));
                    }}
                  >
                    <SelectTrigger className="text-xs h-8"><SelectValue placeholder="Select task..." /></SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="none">None</SelectItem>
                      {available.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        exclusionLinks: prev.exclusionLinks.filter((_, i) => i !== idx),
                      }));
                    }}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Schedule Constraint */}
          {!(task.subTasks && task.subTasks.length > 0) && (
          <div className="p-3 rounded-lg border space-y-3">
            <div className="flex items-center gap-2">
              <Pin className="w-4 h-4 text-primary" />
              <Label className="text-xs font-medium">Schedule Constraint</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[280px] text-xs">
                    Constraints override or limit how dependencies set this task's dates. Use ASAP (default) to let dependencies drive scheduling.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Select
              value={formData.constraintType || 'ASAP'}
              onValueChange={(v: ScheduleConstraintType) => {
                if (v === 'ASAP') {
                  setFormData({ ...formData, constraintType: v, constraintDate: null });
                } else {
                  setFormData({ ...formData, constraintType: v, constraintDate: formData.constraintDate || formData.startDate });
                }
              }}
            >
              <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover">
                {Object.entries(CONSTRAINT_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    <span>{key} — {config.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formData.constraintType && formData.constraintType !== 'ASAP' && (
              <>
                <p className="text-[11px] text-muted-foreground">
                  {CONSTRAINT_CONFIG[formData.constraintType].description}
                </p>
                <div>
                  <Label className="text-xs font-medium">Constraint Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal mt-1 text-xs")}>
                        <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                        {formData.constraintDate ? format(parseISO(formData.constraintDate), 'MMM dd, yyyy') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.constraintDate ? parseISO(formData.constraintDate) : undefined}
                        onSelect={date => {
                          if (date) setFormData({ ...formData, constraintDate: format(date, 'yyyy-MM-dd') });
                        }}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </>
            )}
          </div>
          )}

          {/* Contingency Buffer - hidden for parent tasks */}
          {!(task.subTasks && task.subTasks.length > 0) && (
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
          )}

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
