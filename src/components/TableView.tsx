import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { differenceInDays, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { ChevronDown, ChevronRight, Plus, MoreHorizontal, GripVertical, Pencil, Trash2, Settings2, Eye, EyeOff, Target, X, RefreshCw } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useProject } from '@/context/ProjectContext';
import { flattenTasks } from '@/hooks/useProjectData';
import { TaskRow } from './TaskRow';
import { TaskDialog } from './TaskDialog';
import { BucketDialog } from './BucketDialog';
import { OwnerAvatar } from './OwnerAvatar';
import { Task } from '@/types/project';
import { cn } from '@/lib/utils';
import { format, addDays } from 'date-fns';
import { ALL_COLUMNS, loadVisibleColumns, saveVisibleColumns, buildGridTemplate, getVisibleColumns, calcMinWidth } from './tableColumns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

function InlineInput({ placeholder, onSubmit, onCancel, initialValue = '' }: { placeholder: string; onSubmit: (value: string) => void; onCancel: () => void; initialValue?: string }) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && value.trim()) { onSubmit(value.trim()); }
    if (e.key === 'Escape') onCancel();
  };

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={e => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => { if (value.trim()) onSubmit(value.trim()); else onCancel(); }}
      placeholder={placeholder}
      className="bg-transparent border-b border-primary/40 text-sm px-1 py-0.5 outline-none text-foreground placeholder:text-muted-foreground w-64 font-bold"
    />
  );
}

export function TableView() {
  const { project, toggleBucket, addBucket, updateBucket, deleteBucket, moveBucket, addTask, createTaskFull, moveTask, deleteTask, members, setBaseline, clearBaseline, slackDays, refreshSchedule } = useProject();
  const [addingBucket, setAddingBucket] = useState(false);
  const [editingBucketId, setEditingBucketId] = useState<string | null>(null);
  const [editDialogBucketId, setEditDialogBucketId] = useState<string | null>(null);
  const [newTaskBucketId, setNewTaskBucketId] = useState<string | null>(null);
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>(loadVisibleColumns);

  const toggleColumn = (colId: string) => {
    setVisibleColumnIds(prev => {
      const next = prev.includes(colId)
        ? prev.filter(id => id !== colId)
        : [...prev, colId];
      saveVisibleColumns(next);
      return next;
    });
  };

  const gridCols = useMemo(() => buildGridTemplate(visibleColumnIds), [visibleColumnIds]);
  const visibleCols = useMemo(() => getVisibleColumns(visibleColumnIds), [visibleColumnIds]);
  const minWidth = useMemo(() => calcMinWidth(visibleColumnIds), [visibleColumnIds]);
  const toggleableColumns = ALL_COLUMNS.filter(c => !c.locked && c.label);

  const today = format(new Date(), 'yyyy-MM-dd');
  const defaultEndDate = format(addDays(new Date(), 7), 'yyyy-MM-dd');

  const newTaskTemplate: Task = {
    id: 'new',
    title: 'New Task',
    status: 'not-started',
    priority: 'medium',
    owner: { id: 'unknown', name: 'Unassigned', color: '#999' },
    startDate: today,
    endDate: defaultEndDate,
    estimatedCost: 0,
    actualCost: 0,
    dependsOn: null,
    dependencyType: 'FS',
    flaggedAsRisk: false,
    bufferDays: 0,
    bufferPosition: 'end',
    riskImpact: 1,
    riskProbability: 1,
    riskDescription: '',
    parentTaskId: null,
    responsible: null,
    progress: 0,
    effortHours: 0,
    baselineStartDate: null,
    baselineEndDate: null,
    realizedCost: 0,
    subTasks: [],
  };

  const totalEstimated = project.buckets.reduce(
    (sum, b) => sum + flattenTasks(b.tasks).reduce((s, t) => s + t.estimatedCost, 0), 0
  );
  const totalActual = project.buckets.reduce(
    (sum, b) => sum + flattenTasks(b.tasks).reduce((s, t) => s + t.actualCost, 0), 0
  );
  const contingencyAmount = totalEstimated * (project.contingencyPercent / 100);
  const totalRealizedRiskCost = project.buckets.reduce(
    (sum, b) => sum + flattenTasks(b.tasks).filter(t => t.flaggedAsRisk).reduce((s, t) => s + (t.realizedCost || 0), 0), 0
  );
  const remainingContingency = contingencyAmount - totalRealizedRiskCost;

  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;
    const { draggableId, source, destination, type } = result;
    
    if (type === 'BUCKET') {
      if (source.index !== destination.index) {
        moveBucket(draggableId, destination.index);
      }
      return;
    }
    
    moveTask(draggableId, destination.droppableId, destination.index);
  }, [moveTask, moveBucket]);

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track progress across all project phases
            </p>
          </div>

          {/* Column Settings & Set Baseline */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={async () => {
                await refreshSchedule();
                toast('Schedule refreshed', { description: 'All task dates have been recalculated.' });
              }}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh Schedule
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => {
                if (confirm('This will snapshot all current task dates as the baseline. Any previous baseline will be overwritten. Continue?')) {
                  setBaseline();
                }
              }}
            >
              <Target className="w-3.5 h-3.5" />
              Set Baseline
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-muted-foreground"
              onClick={() => {
                if (confirm('Clear baseline dates from all tasks?')) {
                  clearBaseline();
                }
              }}
            >
              <X className="w-3.5 h-3.5" />
              Clear Baseline
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <Settings2 className="w-3.5 h-3.5" />
                  Columns
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-52 p-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1.5">
                  Toggle Columns
                </p>
                {toggleableColumns.map(col => {
                  const isVisible = visibleColumnIds.includes(col.id);
                  return (
                    <button
                      key={col.id}
                      onClick={() => toggleColumn(col.id)}
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm hover:bg-muted transition-colors"
                    >
                      {isVisible ? (
                        <Eye className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                      <span className={cn(!isVisible && "text-muted-foreground")}>{col.label}</span>
                    </button>
                  );
                })}
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="overflow-x-auto">
        <div style={{ minWidth }}>
        {/* Column Headers */}
        <div className="sticky top-0 z-10 bg-background border-b">
          <div className="grid gap-0 px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider" style={{ gridTemplateColumns: gridCols }}>
            {visibleCols.map(col => (
              <span key={col.id} className={cn(col.align === 'right' && 'text-right')}>
                {col.label}
              </span>
            ))}
          </div>
        </div>

        {/* Buckets with DnD */}
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="buckets-list" type="BUCKET">
            {(bucketsProvided) => (
              <LayoutGroup>
              <div
                ref={bucketsProvided.innerRef}
                {...bucketsProvided.droppableProps}
                className="space-y-3 mt-3"
              >
                {project.buckets.map((bucket, bucketIndex) => {
              const allBucketTasks = flattenTasks(bucket.tasks);
              const bucketEstimated = allBucketTasks.reduce((s, t) => s + t.estimatedCost, 0);
              const bucketActual = allBucketTasks.reduce((s, t) => s + t.actualCost, 0);
              const dates = allBucketTasks.flatMap(t => [parseISO(t.startDate), parseISO(t.endDate)]);
              const bucketStart = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : null;
              const bucketEnd = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;

              const subtotalCells = visibleCols.map(col => {
                if (col.id === 'task') return <span key={col.id} className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">Subtotal</span>;
                if (col.id === 'estCost') return <span key={col.id} className="text-right font-bold tabular-nums">${bucketEstimated.toLocaleString()}</span>;
                if (col.id === 'actual') return <span key={col.id} className="text-right font-bold tabular-nums">${bucketActual.toLocaleString()}</span>;
                return <span key={col.id}></span>;
              });

              return (
                <Draggable key={bucket.id} draggableId={bucket.id} index={bucketIndex}>
                  {(bucketDragProvided, bucketDragSnapshot) => (
                    <motion.div
                      layout
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      ref={bucketDragProvided.innerRef}
                      {...bucketDragProvided.draggableProps}
                      className={cn("rounded-xl border overflow-visible shadow-sm", bucketDragSnapshot.isDragging && "shadow-lg ring-2 ring-primary/20")}
                    >
                  {/* Bucket Header */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                    style={{ borderLeft: `4px solid ${bucket.color}` }}
                  >
                    {/* Drag handle for bucket */}
                    <div {...bucketDragProvided.dragHandleProps} className="shrink-0 cursor-grab active:cursor-grabbing">
                      <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                    </div>

                    <button onClick={() => toggleBucket(bucket.id)} className="shrink-0">
                      {bucket.collapsed ? (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>

                    {editingBucketId === bucket.id ? (
                      <InlineInput
                        placeholder="Group name…"
                        initialValue={bucket.name}
                        onSubmit={(name) => { updateBucket(bucket.id, { name }); setEditingBucketId(null); }}
                        onCancel={() => setEditingBucketId(null)}
                      />
                    ) : (
                      <div className="flex items-center gap-2 min-w-0">
                        {bucket.ownerId && members.find(m => m.user_id === bucket.ownerId) && (
                          <OwnerAvatar
                            owner={{
                              id: bucket.ownerId,
                              name: members.find(m => m.user_id === bucket.ownerId)!.profile.display_name,
                              color: bucket.color,
                            }}
                            size="sm"
                          />
                        )}
                        <div className="min-w-0">
                          <span
                            onDoubleClick={(e) => { e.stopPropagation(); setEditingBucketId(bucket.id); }}
                            className="font-bold text-sm text-left cursor-pointer select-none block"
                            style={{ color: bucket.color }}
                          >
                            {bucket.name}
                          </span>
                          {bucket.description && (
                            <span className="text-[11px] text-muted-foreground truncate block max-w-xs">
                              {bucket.description}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <span className="text-xs text-muted-foreground">
                      {allBucketTasks.length} tasks
                    </span>
                    {bucketStart && bucketEnd && (
                      <span className="text-xs text-muted-foreground ml-auto mr-2">
                        {format(bucketStart, 'MMM dd')} – {format(bucketEnd, 'MMM dd')}
                      </span>
                    )}

                    {/* Bucket Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1.5 rounded-md hover:bg-muted transition-colors shrink-0" onClick={e => e.stopPropagation()}>
                          <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover">
                        <DropdownMenuItem onClick={() => setEditDialogBucketId(bucket.id)}>
                          <Settings2 className="w-3.5 h-3.5 mr-2" />
                          Edit Group
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditingBucketId(bucket.id)}>
                          <Pencil className="w-3.5 h-3.5 mr-2" />
                          Rename Group
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => { if (confirm(`Delete "${bucket.name}" and all its tasks?`)) deleteBucket(bucket.id); }}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-2" />
                          Delete Group
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <AnimatePresence initial={false}>
                    {!bucket.collapsed && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        className="overflow-hidden"
                      >
                        <Droppable droppableId={bucket.id} type="TASK">
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={cn("min-h-[2px]", snapshot.isDraggingOver && "bg-primary/5")}
                            >
                              {bucket.tasks.map((task, index) => (
                                <Draggable key={task.id} draggableId={task.id} index={index}>
                                  {(dragProvided, dragSnapshot) => (
                                    <div
                                      ref={dragProvided.innerRef}
                                      {...dragProvided.draggableProps}
                                      className={cn(dragSnapshot.isDragging && "shadow-lg rounded-lg bg-background")}
                                    >
                                      <TaskRow
                                        task={task}
                                        bucketId={bucket.id}
                                        bucketColor={bucket.color}
                                        dragHandleProps={dragProvided.dragHandleProps}
                                        gridCols={gridCols}
                                        visibleColumnIds={visibleColumnIds}
                                        slackDays={slackDays}
                                      />
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>

                        {/* Add Task */}
                        <div className="px-4 py-1.5" style={{ borderLeft: `4px solid ${bucket.color}` }}>
                          <button
                            onClick={() => setNewTaskBucketId(bucket.id)}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors ml-6"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Task</span>
                          </button>
                        </div>

                        {/* Bucket Footer */}
                        <div
                          className="grid gap-0 px-4 py-2.5 bg-muted/30 border-t text-sm"
                          style={{ gridTemplateColumns: gridCols, borderLeft: `4px solid ${bucket.color}` }}
                        >
                          {subtotalCells}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                    </motion.div>
                  )}
                </Draggable>
              );
            })}
                {bucketsProvided.placeholder}
              </div>
              </LayoutGroup>
            )}
          </Droppable>
        </DragDropContext>
        </div>
        </div>

        {/* Add Group */}
        <div className="mt-3">
          {addingBucket ? (
            <div className="px-4 py-2">
              <InlineInput
                placeholder="Group name…"
                onSubmit={(name) => { addBucket(name); setAddingBucket(false); }}
                onCancel={() => setAddingBucket(false)}
              />
            </div>
          ) : (
            <button
              onClick={() => setAddingBucket(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Group</span>
            </button>
          )}
        </div>

        {/* Financial Summary */}
        {(() => {
          const budgetWithContingency = totalEstimated + contingencyAmount;
          const burnPercent = budgetWithContingency > 0 ? Math.min((totalActual / budgetWithContingency) * 100, 100) : 0;
          const isOverBudget = totalActual > totalEstimated;
          const isOverTotal = totalActual > budgetWithContingency;
          const remaining = totalEstimated - totalActual;

          return (
            <div className="mt-6 rounded-xl border bg-muted/20 p-5">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Project Financial Summary & Schedule Health
              </h3>

              {/* Slippage Summary */}
              {(() => {
                const allTasks = project.buckets.flatMap(b => flattenTasks(b.tasks));
                const tasksWithBaseline = allTasks.filter(t => t.baselineEndDate);
                const hasBaseline = tasksWithBaseline.length > 0;

                if (!hasBaseline) return null;

                const slippages = tasksWithBaseline.map(t => differenceInDays(parseISO(t.endDate), parseISO(t.baselineEndDate!)));
                const totalSlip = slippages.reduce((s, d) => s + d, 0);
                const maxSlip = Math.max(...slippages);
                const slippedCount = slippages.filter(d => d > 0).length;
                const aheadCount = slippages.filter(d => d < 0).length;
                const onTrackCount = slippages.filter(d => d === 0).length;

                return (
                  <div className="grid grid-cols-5 gap-6 mb-5 pb-5 border-b">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Net Slippage</p>
                      <p className={cn("text-2xl font-bold tabular-nums", totalSlip > 0 ? "text-destructive" : totalSlip < 0 ? "text-[hsl(var(--status-done))]" : "text-foreground")}>
                        {totalSlip > 0 ? '+' : ''}{totalSlip}d
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Max Slippage</p>
                      <p className={cn("text-2xl font-bold tabular-nums", maxSlip > 0 ? "text-destructive" : "text-foreground")}>
                        {maxSlip > 0 ? '+' : ''}{maxSlip}d
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Slipped</p>
                      <p className={cn("text-2xl font-bold tabular-nums", slippedCount > 0 ? "text-destructive" : "text-foreground")}>
                        {slippedCount} <span className="text-xs font-normal text-muted-foreground">tasks</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">On Track</p>
                      <p className="text-2xl font-bold tabular-nums text-foreground">
                        {onTrackCount} <span className="text-xs font-normal text-muted-foreground">tasks</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Ahead</p>
                      <p className={cn("text-2xl font-bold tabular-nums", aheadCount > 0 ? "text-[hsl(var(--status-done))]" : "text-foreground")}>
                        {aheadCount} <span className="text-xs font-normal text-muted-foreground">tasks</span>
                      </p>
                    </div>
                  </div>
                );
              })()}
              <div className="grid grid-cols-3 gap-6 mb-5">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Total Budget</p>
                  <p className="text-2xl font-bold text-foreground tabular-nums">
                    ${totalEstimated.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Actual Cost</p>
                  <p className={cn("text-2xl font-bold tabular-nums", isOverBudget ? "text-destructive" : "text-foreground")}>
                    ${totalActual.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Remaining</p>
                  <p className={cn("text-2xl font-bold tabular-nums", remaining < 0 ? "text-destructive" : "text-foreground")}>
                    {remaining < 0 ? '-' : ''}${Math.abs(remaining).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-6 mb-5">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    With {project.contingencyPercent}% Contingency
                  </p>
                  <p className="text-2xl font-bold text-primary tabular-nums">
                    ${budgetWithContingency.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Realized Risk Cost</p>
                  <p className={cn("text-2xl font-bold tabular-nums", totalRealizedRiskCost > 0 ? "text-[hsl(var(--priority-high))]" : "text-foreground")}>
                    ${totalRealizedRiskCost.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Remaining Contingency</p>
                  <p className={cn("text-2xl font-bold tabular-nums", remainingContingency < 0 ? "text-destructive" : "text-foreground")}>
                    {remainingContingency < 0 ? '-' : ''}${Math.abs(remainingContingency).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Burn Rate Bar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Burn Rate</p>
                  <p className={cn("text-xs font-bold tabular-nums", isOverTotal ? "text-destructive" : "text-foreground")}>
                    {burnPercent.toFixed(1)}% of budget used
                  </p>
                </div>
                <div className="relative h-3 rounded-full bg-muted overflow-hidden">
                  {/* Estimated budget threshold marker */}
                  {project.contingencyPercent > 0 && (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-foreground/30 z-10"
                      style={{ left: `${(totalEstimated / budgetWithContingency) * 100}%` }}
                      title="Base budget (excl. contingency)"
                    />
                  )}
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      isOverTotal
                        ? "bg-destructive"
                        : isOverBudget
                          ? "bg-[hsl(var(--priority-high))]"
                          : "bg-[hsl(var(--status-done))]"
                    )}
                    style={{ width: `${burnPercent}%` }}
                  />
                </div>
                {project.contingencyPercent > 0 && (
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-muted-foreground">$0</span>
                    <span className="text-[10px] text-muted-foreground" style={{ marginRight: `${100 - (totalEstimated / budgetWithContingency) * 100}%` }}>
                      Budget ${totalEstimated.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-muted-foreground">${budgetWithContingency.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* New Task Dialog */}
      {newTaskBucketId && (
        <TaskDialog
          task={newTaskTemplate}
          open={true}
          onOpenChange={(open) => { if (!open) setNewTaskBucketId(null); }}
          isNew
          onCreateSave={(data) => {
            createTaskFull(newTaskBucketId, data);
            setNewTaskBucketId(null);
          }}
        />
      )}

      {/* Bucket Edit Dialog */}
      {editDialogBucketId && (() => {
        const bucket = project.buckets.find(b => b.id === editDialogBucketId);
        if (!bucket) return null;
        return (
          <BucketDialog
            bucket={bucket}
            open={true}
            onOpenChange={(open) => { if (!open) setEditDialogBucketId(null); }}
            onSave={(updates) => updateBucket(editDialogBucketId, updates)}
            members={members}
          />
        );
      })()}
    </div>
  );
}
