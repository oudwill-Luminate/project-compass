import { useState, useCallback } from 'react';
import { useProject } from '@/context/ProjectContext';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { FileText, Target, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export function ProjectOverview() {
  const { project, updateCharter, goals, addGoal, updateGoal, deleteGoal } = useProject();
  const [charter, setCharter] = useState(project.charterMarkdown);
  const [saving, setSaving] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState('');

  const hasCharterChanges = charter !== project.charterMarkdown;

  const handleSaveCharter = useCallback(async () => {
    setSaving(true);
    try {
      await updateCharter(charter);
      toast.success('Charter saved');
    } catch {
      toast.error('Failed to save charter');
    } finally {
      setSaving(false);
    }
  }, [charter, updateCharter]);

  const handleAddGoal = useCallback(async () => {
    if (!newGoalTitle.trim()) return;
    if (goals.length >= 5) {
      toast.error('Maximum 5 goals allowed');
      return;
    }
    await addGoal(newGoalTitle.trim());
    setNewGoalTitle('');
  }, [newGoalTitle, goals.length, addGoal]);

  return (
    <div className="flex-1 overflow-auto p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <FileText className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Project Overview</h2>
            <p className="text-sm text-muted-foreground">Charter & strategic goals</p>
          </div>
        </div>

        {/* Project Charter */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Project Charter</Label>
          <p className="text-xs text-muted-foreground">
            Describe the project scope, objectives, stakeholders, and constraints using Markdown.
          </p>
          <Textarea
            value={charter}
            onChange={e => setCharter(e.target.value)}
            placeholder="# Project Charter&#10;&#10;## Objectives&#10;- ...&#10;&#10;## Scope&#10;...&#10;&#10;## Stakeholders&#10;..."
            className="min-h-[200px] font-mono text-sm"
          />
          <Button
            onClick={handleSaveCharter}
            disabled={!hasCharterChanges || saving}
            size="sm"
          >
            {saving ? 'Saving…' : 'Save Charter'}
          </Button>
        </div>

        {/* Project Goals */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            <Label className="text-sm font-semibold">Project Goals</Label>
            <span className="text-xs text-muted-foreground">({goals.length}/5)</span>
          </div>

          <div className="space-y-3">
            {goals.map(goal => (
              <div key={goal.id} className="p-4 rounded-lg border bg-card space-y-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={goal.title}
                    onChange={e => updateGoal(goal.id, { title: e.target.value })}
                    placeholder="Goal title"
                    className="flex-1 text-sm font-medium"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteGoal(goal.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Progress</span>
                    <span className="text-xs font-medium">{goal.progress}%</span>
                  </div>
                  <Progress value={goal.progress} className="h-2" />
                  <Slider
                    value={[goal.progress]}
                    onValueChange={([v]) => updateGoal(goal.id, { progress: v })}
                    max={100}
                    step={5}
                    className="mt-1"
                  />
                </div>
              </div>
            ))}
          </div>

          {goals.length < 5 && (
            <div className="flex gap-2">
              <Input
                value={newGoalTitle}
                onChange={e => setNewGoalTitle(e.target.value)}
                placeholder="New goal title…"
                className="text-sm"
                onKeyDown={e => e.key === 'Enter' && handleAddGoal()}
              />
              <Button onClick={handleAddGoal} size="sm" disabled={!newGoalTitle.trim()}>
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
