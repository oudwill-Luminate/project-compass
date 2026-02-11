import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useProject } from '@/context/ProjectContext';
import { TaskRow } from './TaskRow';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

function InlineInput({ placeholder, onSubmit, onCancel }: { placeholder: string; onSubmit: (value: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && value.trim()) { onSubmit(value.trim()); setValue(''); }
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
      className="bg-transparent border-b border-primary/40 text-sm px-1 py-0.5 outline-none text-foreground placeholder:text-muted-foreground w-64"
    />
  );
}

export function TableView() {
  const { project, toggleBucket, addBucket, addTask, moveTask } = useProject();
  const [addingBucket, setAddingBucket] = useState(false);
  const [addingTaskInBucket, setAddingTaskInBucket] = useState<string | null>(null);

  const totalEstimated = project.buckets.reduce(
    (sum, b) => sum + b.tasks.reduce((s, t) => s + t.estimatedCost, 0), 0
  );
  const totalActual = project.buckets.reduce(
    (sum, b) => sum + b.tasks.reduce((s, t) => s + t.actualCost, 0), 0
  );
  const contingencyAmount = totalEstimated * (project.contingencyPercent / 100);

  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const newBucketId = destination.droppableId;
    const newPosition = destination.index;
    moveTask(draggableId, newBucketId, newPosition);
  }, [moveTask]);

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track progress across all project phases
          </p>
        </div>

        {/* Column Headers */}
        <div className="sticky top-0 z-10 bg-background border-b">
          <div className="grid grid-cols-[24px_1fr_140px_100px_100px_110px_110px_110px_110px_50px] gap-0 px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            <span></span>
            <span>Task</span>
            <span>Status</span>
            <span>Priority</span>
            <span>Owner</span>
            <span>Start</span>
            <span>End</span>
            <span className="text-right">Est. Cost</span>
            <span className="text-right">Actual</span>
            <span></span>
          </div>
        </div>

        {/* Buckets with DnD */}
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="space-y-3 mt-3">
            {project.buckets.map(bucket => {
              const bucketEstimated = bucket.tasks.reduce((s, t) => s + t.estimatedCost, 0);
              const bucketActual = bucket.tasks.reduce((s, t) => s + t.actualCost, 0);
              const dates = bucket.tasks.flatMap(t => [parseISO(t.startDate), parseISO(t.endDate)]);
              const bucketStart = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : null;
              const bucketEnd = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;

              return (
                <div key={bucket.id} className="rounded-xl border overflow-hidden shadow-sm">
                  <button
                    onClick={() => toggleBucket(bucket.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                    style={{ borderLeft: `4px solid ${bucket.color}` }}
                  >
                    {bucket.collapsed ? (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="font-bold text-sm" style={{ color: bucket.color }}>
                      {bucket.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {bucket.tasks.length} tasks
                    </span>
                    {bucketStart && bucketEnd && (
                      <span className="text-xs text-muted-foreground ml-auto mr-2">
                        {format(bucketStart, 'MMM dd')} – {format(bucketEnd, 'MMM dd')}
                      </span>
                    )}
                  </button>

                  <AnimatePresence initial={false}>
                    {!bucket.collapsed && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <Droppable droppableId={bucket.id}>
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
                                        bucketColor={bucket.color}
                                        dragHandleProps={dragProvided.dragHandleProps}
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
                          {addingTaskInBucket === bucket.id ? (
                            <InlineInput
                              placeholder="Task name…"
                              onSubmit={(name) => { addTask(bucket.id, name); setAddingTaskInBucket(null); }}
                              onCancel={() => setAddingTaskInBucket(null)}
                            />
                          ) : (
                            <button
                              onClick={() => setAddingTaskInBucket(bucket.id)}
                              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors ml-6"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add Task</span>
                            </button>
                          )}
                        </div>

                        {/* Bucket Footer */}
                        <div
                          className="grid grid-cols-[24px_1fr_140px_100px_100px_110px_110px_110px_110px_50px] gap-0 px-4 py-2.5 bg-muted/30 border-t text-sm"
                          style={{ borderLeft: `4px solid ${bucket.color}` }}
                        >
                          <span></span>
                          <span className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                            Subtotal
                          </span>
                          <span></span><span></span><span></span><span></span><span></span>
                          <span className="text-right font-bold tabular-nums">
                            ${bucketEstimated.toLocaleString()}
                          </span>
                          <span className="text-right font-bold tabular-nums">
                            ${bucketActual.toLocaleString()}
                          </span>
                          <span></span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </DragDropContext>

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
    </div>
  );
}

