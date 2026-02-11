import { useState } from 'react';
import { useProject } from '@/context/ProjectContext';
import { OwnerAvatar } from './OwnerAvatar';
import { TaskDialog } from './TaskDialog';
import { Task } from '@/types/project';
import { AlertTriangle, ShieldAlert, ChevronDown, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';

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

export function RiskRegistry() {
  const { project, updateTask } = useProject();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingTask, setEditingTask] = useState<Task | null>(null);

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

                return (
                  <div
                    key={task.id}
                    className="rounded-xl border hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-4 p-4">
                      {/* Expand toggle */}
                      <button
                        onClick={() => hasDescription && toggleExpanded(task.id)}
                        className={cn(
                          "shrink-0 transition-transform",
                          hasDescription ? "cursor-pointer text-muted-foreground hover:text-foreground" : "text-transparent cursor-default"
                        )}
                        disabled={!hasDescription}
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

                    {/* Collapsible description */}
                    <AnimatePresence>
                      {isExpanded && hasDescription && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 pl-[4.25rem]">
                            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap bg-muted/30 rounded-lg p-3 border border-border/40">
                              {task.riskDescription}
                            </p>
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
