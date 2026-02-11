import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Plus, MoreHorizontal, GripVertical, Pencil, Trash2, Settings2, Eye, EyeOff } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useProject } from '@/context/ProjectContext';
import { flattenTasks } from '@/hooks/useProjectData';
import { TaskRow } from './TaskRow';
import { TaskDialog } from './TaskDialog';
import { BucketDialog } from './BucketDialog';
import { OwnerAvatar } from './OwnerAvatar';
import { Task } from '@/types/project';
import { cn } from '@/lib/utils';
import { format, parseISO, addDays } from 'date-fns';
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
  const { project, toggleBucket, addBucket, updateBucket, deleteBucket, moveBucket, addTask, createTaskFull, moveTask, deleteTask, members } = useProject();
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
    subTasks: [],
  };

  const totalEstimated = project.buckets.reduce(
    (sum, b) => sum + flattenTasks(b.tasks).reduce((s, t) => s + t.estimatedCost, 0), 0
  );
  const totalActual = project.buckets.reduce(
    (sum, b) => sum + flattenTasks(b.tasks).reduce((s, t) => s + t.actualCost, 0), 0
  );
  const contingencyAmount = totalEstimated * (project.contingencyPercent / 100);

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

          {/* Column Settings */}
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
                    <div
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
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
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
                    </div>
                  )}
                </Draggable>
              );
            })}
                {bucketsProvided.placeholder}
              </div>
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
        <div className="mt-6 rounded-xl border bg-muted/20 p-5">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Project Financial Summary
          </h3>
          <div className="grid grid-cols-4 gap-6">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Total Budget</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">
                ${totalEstimated.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Actual Cost</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">
                ${totalActual.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Remaining</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">
                ${(totalEstimated - totalActual).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                With {project.contingencyPercent}% Contingency
              </p>
              <p className="text-2xl font-bold text-primary tabular-nums">
                ${(totalEstimated + contingencyAmount).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
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
