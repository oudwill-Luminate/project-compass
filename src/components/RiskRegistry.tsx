import { useState, useEffect, useCallback } from 'react';
import { useProject } from '@/context/ProjectContext';
import { OwnerAvatar } from './OwnerAvatar';
import { TaskDialog } from './TaskDialog';
import { Task } from '@/types/project';
import { AlertTriangle, ShieldAlert, ChevronDown, Pencil, TrendingUp, TrendingDown, Minus, Plus, Trash2, Shield, LifeBuoy, CalendarIcon, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO } from 'date-fns';

interface RiskAction {
  id: string;
  task_id: string;
  action_type: 'mitigation' | 'contingency';
  description: string;
  owner_id: string | null;
  due_date: string | null;
}

const RISK_LABELS = {
  impact: ['', 'Negligible', 'Minor', 'Moderate', 'Major', 'Severe'],
  probability: ['', 'Rare', 'Unlikely', 'Possible', 'Likely', 'Almost Certain'],
};

function getRiskLevel(impact: number, probability: number) {
  const score = impact * probability;
  if (score >= 15) return { label: 'Critical', cssColor: 'hsl(var(--status-stuck))' };
  if (score >= 10) return { label: 'High', cssColor: 'hsl(var(--status-working))' };
  if (score >= 5) return { label: 'Medium', cssColor: 'hsl(var(--priority-medium))' };
  return { label: 'Low', cssColor: 'hsl(var(--status-done))' };
}

function getRiskCellBg(impact: number, probability: number): string {
  const score = impact * probability;
  if (score >= 15) return 'hsl(var(--status-stuck) / 0.2)';
  if (score >= 10) return 'hsl(var(--status-working) / 0.2)';
  if (score >= 5) return 'hsl(var(--priority-medium) / 0.12)';
  return 'hsl(var(--status-done) / 0.15)';
}

interface ActionSectionProps {
  icon: React.ReactNode;
  title: string;
  actions: RiskAction[];
  taskId: string;
  actionType: 'mitigation' | 'contingency';
  placeholder: string;
  members: { id: string; user_id: string; role: string; profile: any }[];
  newActionText: Record<string, string>;
  setNewActionText: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onAdd: (taskId: string, actionType: 'mitigation' | 'contingency') => void;
  onDelete: (actionId: string) => void;
  onUpdateText: (actionId: string, description: string) => void;
  onUpdateOwner: (actionId: string, ownerId: string | null) => void;
  onUpdateDueDate: (actionId: string, dueDate: string | null) => void;
}

function ActionSection({ icon, title, actions, taskId, actionType, placeholder, members, newActionText, setNewActionText, onAdd, onDelete, onUpdateText, onUpdateOwner, onUpdateDueDate }: ActionSectionProps) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
      </div>
      {actions.length > 0 && (
        <div className="space-y-2 mb-2">
          {actions.map(action => {
            const ownerProfile = action.owner_id ? members.find(m => m.user_id === action.owner_id)?.profile : null;
            const isOverdue = action.due_date && new Date(action.due_date) < new Date(new Date().toISOString().split('T')[0]);
            return (
              <div key={action.id} className="group rounded-lg border border-border/40 bg-muted/20 p-2.5 space-y-1.5">
                <div className="flex items-start gap-2">
                  <span className="text-xs text-muted-foreground mt-0.5">•</span>
                  <input
                    className="flex-1 text-xs bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground focus:bg-muted/30 rounded px-1 py-0.5 -ml-1"
                    defaultValue={action.description}
                    onBlur={e => {
                      if (e.target.value !== action.description) onUpdateText(action.id, e.target.value);
                    }}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  />
                  <button
                    onClick={() => onDelete(action.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0 p-0.5"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex items-center gap-2 pl-4">
                  {/* Owner select */}
                  <Select
                    value={action.owner_id || 'unassigned'}
                    onValueChange={v => onUpdateOwner(action.id, v === 'unassigned' ? null : v)}
                  >
                    <SelectTrigger className="h-6 text-[11px] w-[140px] border-border/40 bg-background/50">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3 h-3 text-muted-foreground shrink-0" />
                        <SelectValue placeholder="Owner" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="unassigned" className="text-xs">Unassigned</SelectItem>
                      {members.map(m => (
                        <SelectItem key={m.user_id} value={m.user_id} className="text-xs">
                          {m.profile?.display_name || 'Unknown'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Due date picker */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "h-6 text-[11px] w-[130px] justify-start border-border/40 bg-background/50",
                          isOverdue && "text-destructive border-destructive/30"
                        )}
                      >
                        <CalendarIcon className="w-3 h-3 mr-1.5 shrink-0" />
                        {action.due_date ? format(parseISO(action.due_date), 'MMM dd, yyyy') : 'Due date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={action.due_date ? parseISO(action.due_date) : undefined}
                        onSelect={date => onUpdateDueDate(action.id, date ? format(date, 'yyyy-MM-dd') : null)}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>

                  {ownerProfile && (
                    <span className="text-[10px] text-muted-foreground">{ownerProfile.display_name}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Input
          placeholder={placeholder}
          className="h-7 text-xs flex-1"
          value={newActionText[`${taskId}-${actionType}`] || ''}
          onChange={e => setNewActionText(prev => ({ ...prev, [`${taskId}-${actionType}`]: e.target.value }))}
          onKeyDown={e => { if (e.key === 'Enter') onAdd(taskId, actionType); }}
        />
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 shrink-0"
          onClick={() => onAdd(taskId, actionType)}
        >
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function RiskRegistry() {
  const { project, updateTask, members } = useProject();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [previousCounts, setPreviousCounts] = useState<{ Critical: number; High: number; Medium: number; Low: number } | null>(null);
  const [riskActions, setRiskActions] = useState<Record<string, RiskAction[]>>({});
  const [newActionText, setNewActionText] = useState<Record<string, string>>({});

  function flattenAllTasks(tasks: typeof project.buckets[0]['tasks']): typeof project.buckets[0]['tasks'] {
    const result: typeof project.buckets[0]['tasks'] = [];
    for (const t of tasks) {
      result.push(t);
      if (t.subTasks.length > 0) {
        result.push(...flattenAllTasks(t.subTasks));
      }
    }
    return result;
  }

  const flaggedTasks = project.buckets.flatMap(b =>
    flattenAllTasks(b.tasks)
      .filter(t => t.flaggedAsRisk)
      .map(t => ({ ...t, bucketName: b.name, bucketColor: b.color }))
  );

  const matrixCells: Record<string, typeof flaggedTasks> = {};
  for (let i = 1; i <= 5; i++) {
    for (let p = 1; p <= 5; p++) {
      matrixCells[`${i}-${p}`] = [];
    }
  }
  flaggedTasks.forEach(t => {
    const key = `${t.riskImpact}-${t.riskProbability}`;
    matrixCells[key]?.push(t);
  });

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Fetch risk actions for all flagged tasks
  const fetchRiskActions = useCallback(async () => {
    const taskIds = flaggedTasks.map(t => t.id);
    if (taskIds.length === 0) return;
    const { data } = await supabase
      .from('risk_actions')
      .select('*')
      .in('task_id', taskIds)
      .order('created_at');
    if (data) {
      const grouped: Record<string, RiskAction[]> = {};
      data.forEach((a: any) => {
        if (!grouped[a.task_id]) grouped[a.task_id] = [];
        grouped[a.task_id].push(a);
      });
      setRiskActions(grouped);
    }
  }, [flaggedTasks.length, project.id]);

  useEffect(() => {
    fetchRiskActions();
  }, [fetchRiskActions]);

  const addAction = async (taskId: string, actionType: 'mitigation' | 'contingency') => {
    const text = newActionText[`${taskId}-${actionType}`]?.trim();
    if (!text) return;
    await supabase.from('risk_actions').insert({
      task_id: taskId,
      action_type: actionType,
      description: text,
    });
    setNewActionText(prev => ({ ...prev, [`${taskId}-${actionType}`]: '' }));
    fetchRiskActions();
  };

  const deleteAction = async (actionId: string) => {
    await supabase.from('risk_actions').delete().eq('id', actionId);
    fetchRiskActions();
  };

  const updateActionText = async (actionId: string, description: string) => {
    await supabase.from('risk_actions').update({ description }).eq('id', actionId);
    fetchRiskActions();
  };

  const updateActionOwner = async (actionId: string, ownerId: string | null) => {
    await supabase.from('risk_actions').update({ owner_id: ownerId }).eq('id', actionId);
    fetchRiskActions();
  };

  const updateActionDueDate = async (actionId: string, dueDate: string | null) => {
    await supabase.from('risk_actions').update({ due_date: dueDate }).eq('id', actionId);
    fetchRiskActions();
  };

  // Compute current counts
  const currentCounts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  flaggedTasks.forEach(t => {
    const level = getRiskLevel(t.riskImpact, t.riskProbability).label;
    currentCounts[level as keyof typeof currentCounts]++;
  });

  // Save today's snapshot and fetch previous snapshot
  const saveAndFetchSnapshot = useCallback(async () => {
    if (!project.id) return;

    // Upsert today's snapshot
    await supabase.from('risk_snapshots').upsert({
      project_id: project.id,
      snapshot_date: new Date().toISOString().split('T')[0],
      critical_count: currentCounts.Critical,
      high_count: currentCounts.High,
      medium_count: currentCounts.Medium,
      low_count: currentCounts.Low,
    }, { onConflict: 'project_id,snapshot_date' });

    // Fetch the most recent snapshot before today
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('risk_snapshots')
      .select('*')
      .eq('project_id', project.id)
      .lt('snapshot_date', today)
      .order('snapshot_date', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      setPreviousCounts({
        Critical: data[0].critical_count,
        High: data[0].high_count,
        Medium: data[0].medium_count,
        Low: data[0].low_count,
      });
    }
  }, [project.id, currentCounts.Critical, currentCounts.High, currentCounts.Medium, currentCounts.Low]);

  useEffect(() => {
    saveAndFetchSnapshot();
  }, [saveAndFetchSnapshot]);

  const getTrend = (current: number, previous: number | undefined) => {
    if (previous === undefined) return null;
    if (current > previous) return 'up';
    if (current < previous) return 'down';
    return 'same';
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6" />
            Risk Registry
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor and manage project risks with the Impact / Probability matrix
          </p>
        </div>

        {/* Risk Summary Cards */}
        {(() => {
          const cards = [
            { label: 'Critical' as const, count: currentCounts.Critical, prevKey: 'Critical' as const, color: 'hsl(var(--status-stuck))', bg: 'hsl(var(--status-stuck) / 0.1)' },
            { label: 'High' as const, count: currentCounts.High, prevKey: 'High' as const, color: 'hsl(var(--status-working))', bg: 'hsl(var(--status-working) / 0.1)' },
            { label: 'Medium' as const, count: currentCounts.Medium, prevKey: 'Medium' as const, color: 'hsl(var(--priority-medium))', bg: 'hsl(var(--priority-medium) / 0.1)' },
            { label: 'Low' as const, count: currentCounts.Low, prevKey: 'Low' as const, color: 'hsl(var(--status-done))', bg: 'hsl(var(--status-done) / 0.1)' },
          ];
          return (
            <div className="grid grid-cols-4 gap-3 mb-8">
              {cards.map(c => {
                const trend = previousCounts ? getTrend(c.count, previousCounts[c.prevKey]) : null;
                const diff = previousCounts ? c.count - previousCounts[c.prevKey] : 0;
                return (
                  <div
                    key={c.label}
                    className="rounded-xl border p-4 flex flex-col items-center gap-1"
                    style={{ backgroundColor: c.bg }}
                  >
                    <span className="text-2xl font-bold" style={{ color: c.color }}>{c.count}</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                      <span className="text-xs font-medium text-muted-foreground">{c.label}</span>
                    </div>
                    {trend && (
                      <div className={cn(
                        "flex items-center gap-1 mt-1 text-[10px] font-medium",
                        trend === 'up' && "text-destructive",
                        trend === 'down' && "text-emerald-500",
                        trend === 'same' && "text-muted-foreground"
                      )}>
                        {trend === 'up' && <TrendingUp className="w-3 h-3" />}
                        {trend === 'down' && <TrendingDown className="w-3 h-3" />}
                        {trend === 'same' && <Minus className="w-3 h-3" />}
                        <span>{trend === 'same' ? 'No change' : `${diff > 0 ? '+' : ''}${diff} vs prev`}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* 5×5 Risk Matrix */}
        <div className="mb-10">
          <h2 className="text-sm font-bold text-foreground mb-4">Impact / Probability Matrix</h2>
          <div className="inline-block">
            <div className="flex items-stretch">
              <div className="w-8 flex items-center justify-center">
                <span className="text-[11px] text-muted-foreground font-semibold -rotate-90 whitespace-nowrap tracking-wider">
                  IMPACT →
                </span>
              </div>

              <div>
                {[5, 4, 3, 2, 1].map(impact => (
                  <div key={impact} className="flex items-center">
                    <div className="w-20 pr-2 text-right">
                      <span className="text-[11px] text-muted-foreground">
                        {RISK_LABELS.impact[impact]}
                      </span>
                    </div>
                    {[1, 2, 3, 4, 5].map(prob => {
                      const tasks = matrixCells[`${impact}-${prob}`];
                      return (
                        <div
                          key={prob}
                          className="w-[72px] h-[72px] border border-border/40 flex flex-wrap items-center justify-center gap-1 p-1 transition-colors"
                          style={{ backgroundColor: getRiskCellBg(impact, prob) }}
                        >
                          {tasks.map(t => (
                            <div
                              key={t.id}
                              className="w-5 h-5 rounded-full border-2 border-background shadow-sm cursor-pointer hover:scale-125 transition-transform"
                              style={{ backgroundColor: t.bucketColor }}
                              title={`${t.title} (${t.bucketName})`}
                              onClick={() => setEditingTask(t)}
                            />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ))}

                <div className="flex ml-20 mt-1">
                  {[1, 2, 3, 4, 5].map(prob => (
                    <div key={prob} className="w-[72px] text-center">
                      <span className="text-[10px] text-muted-foreground leading-tight">
                        {RISK_LABELS.probability[prob]}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="text-center text-[11px] text-muted-foreground font-semibold mt-1 ml-20 tracking-wider">
                  PROBABILITY →
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Risk List */}
        <div>
          <h2 className="text-sm font-bold text-foreground mb-4">
            Flagged Risks ({flaggedTasks.length})
          </h2>

          {flaggedTasks.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground border rounded-xl bg-muted/10">
              <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="font-medium">No tasks flagged as risks</p>
              <p className="text-xs mt-1 opacity-60">
                Use the task menu (⋯) to flag tasks as risks
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {flaggedTasks.map(task => {
                const risk = getRiskLevel(task.riskImpact, task.riskProbability);
                const isExpanded = expandedIds.has(task.id);
                const hasDescription = !!task.riskDescription?.trim();
                const taskActions = riskActions[task.id] || [];
                const mitigations = taskActions.filter(a => a.action_type === 'mitigation');
                const contingencies = taskActions.filter(a => a.action_type === 'contingency');

                return (
                  <div
                    key={task.id}
                    className="rounded-xl border hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-4 p-4">
                      {/* Expand toggle */}
                      <button
                        onClick={() => toggleExpanded(task.id)}
                        className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground transition-transform"
                      >
                        <ChevronDown className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-180")} />
                      </button>

                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: risk.cssColor }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-foreground">{task.title}</span>
                          <span
                            className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                            style={{
                              backgroundColor: task.bucketColor + '18',
                              color: task.bucketColor,
                            }}
                          >
                            {task.bucketName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>Impact: <strong>{RISK_LABELS.impact[task.riskImpact]}</strong></span>
                          <span className="opacity-30">•</span>
                          <span>Prob: <strong>{RISK_LABELS.probability[task.riskProbability]}</strong></span>
                          <span className="opacity-30">•</span>
                          <span className="font-bold" style={{ color: risk.cssColor }}>
                            {risk.label} Risk
                          </span>
                          {(mitigations.length > 0 || contingencies.length > 0) && (
                            <>
                              <span className="opacity-30">•</span>
                              <span className="text-muted-foreground/70">
                                {mitigations.length} mitigation{mitigations.length !== 1 ? 's' : ''}, {contingencies.length} contingenc{contingencies.length !== 1 ? 'ies' : 'y'}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <OwnerAvatar owner={task.owner} />
                      <button
                        onClick={() => setEditingTask(task)}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium px-2 py-1 rounded hover:bg-accent"
                        title="Edit risk"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => updateTask(task.id, { flaggedAsRisk: false, riskImpact: 1, riskProbability: 1, riskDescription: '' })}
                        className="text-xs text-muted-foreground hover:text-destructive transition-colors font-medium px-2 py-1 rounded hover:bg-destructive/10"
                      >
                        Remove
                      </button>
                    </div>

                    {/* Collapsible details: description + mitigation + contingency */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 pl-[4.25rem] space-y-4">
                            {/* Risk description */}
                            {hasDescription && (
                              <div>
                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Description</p>
                                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap bg-muted/30 rounded-lg p-3 border border-border/40">
                                  {task.riskDescription}
                                </p>
                              </div>
                            )}

                            {/* Realized Mitigation Cost */}
                            <div>
                              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Realized Mitigation Cost ($)</p>
                              <Input
                                type="number"
                                min={0}
                                className="h-8 text-xs w-48"
                                value={task.realizedCost || 0}
                                onChange={e => updateTask(task.id, { realizedCost: Number(e.target.value) })}
                              />
                            </div>

                            {/* Mitigation Strategies */}
                            <ActionSection
                              icon={<Shield className="w-3.5 h-3.5 text-muted-foreground" />}
                              title="Mitigation Strategies"
                              actions={mitigations}
                              taskId={task.id}
                              actionType="mitigation"
                              placeholder="Add mitigation strategy..."
                              members={members}
                              newActionText={newActionText}
                              setNewActionText={setNewActionText}
                              onAdd={addAction}
                              onDelete={deleteAction}
                              onUpdateText={updateActionText}
                              onUpdateOwner={updateActionOwner}
                              onUpdateDueDate={updateActionDueDate}
                            />

                            {/* Contingency Plans */}
                            <ActionSection
                              icon={<LifeBuoy className="w-3.5 h-3.5 text-muted-foreground" />}
                              title="Contingency Plans"
                              actions={contingencies}
                              taskId={task.id}
                              actionType="contingency"
                              placeholder="Add contingency plan..."
                              members={members}
                              newActionText={newActionText}
                              setNewActionText={setNewActionText}
                              onAdd={addAction}
                              onDelete={deleteAction}
                              onUpdateText={updateActionText}
                              onUpdateOwner={updateActionOwner}
                              onUpdateDueDate={updateActionDueDate}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Edit task dialog */}
      {editingTask && (
        <TaskDialog
          task={editingTask}
          open={!!editingTask}
          onOpenChange={open => { if (!open) setEditingTask(null); }}
        />
      )}
    </div>
  );
}
