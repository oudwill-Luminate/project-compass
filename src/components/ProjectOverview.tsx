import { useState, useCallback, useMemo } from 'react';
import { useProject } from '@/context/ProjectContext';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Target, Plus, Trash2, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { computeProjectHealth, type HealthStatus } from '@/lib/projectHealth';
import { computeCriticalPath } from '@/lib/criticalPath';

/* ── Lightweight Markdown → React renderer ── */
function renderMarkdown(md: string) {
  const lines = md.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={key++} className="list-disc list-inside space-y-1 text-sm text-foreground">
          {listItems.map((li, i) => <li key={i}>{inlineFormat(li)}</li>)}
        </ul>,
      );
      listItems = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trimEnd();

    // Headings
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.*)/);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const Tag = (`h${level}` as keyof JSX.IntrinsicElements);
      const sizes: Record<number, string> = {
        1: 'text-xl font-bold',
        2: 'text-lg font-semibold',
        3: 'text-base font-semibold',
        4: 'text-sm font-semibold',
      };
      elements.push(<Tag key={key++} className={`${sizes[level]} text-foreground mt-3 mb-1`}>{inlineFormat(text)}</Tag>);
      continue;
    }

    // List items
    if (/^[-*]\s+/.test(trimmed)) {
      listItems.push(trimmed.replace(/^[-*]\s+/, ''));
      continue;
    }

    // Empty line
    if (trimmed === '') {
      flushList();
      continue;
    }

    // Paragraph
    flushList();
    elements.push(<p key={key++} className="text-sm text-foreground leading-relaxed">{inlineFormat(trimmed)}</p>);
  }
  flushList();
  return elements;
}

function inlineFormat(text: string): React.ReactNode {
  // Bold + italic combined, then bold, then italic, then inline code
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[2]) parts.push(<strong key={i}><em>{match[2]}</em></strong>);
    else if (match[3]) parts.push(<strong key={i}>{match[3]}</strong>);
    else if (match[4]) parts.push(<em key={i}>{match[4]}</em>);
    else if (match[5]) parts.push(<code key={i} className="px-1 py-0.5 rounded bg-muted text-xs font-mono">{match[5]}</code>);
    last = match.index + match[0].length;
    i++;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length === 1 ? parts[0] : parts;
}

/* ── Health indicator ── */
const HEALTH_COLORS: Record<HealthStatus, string> = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
};
const HEALTH_LABELS: Record<HealthStatus, string> = {
  green: 'On Track',
  yellow: 'At Risk',
  red: 'Critical',
};

function TrafficLight({ label, status }: { label: string; status: HealthStatus }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`w-3 h-3 rounded-full ${HEALTH_COLORS[status]} shadow-sm`} />
      <div>
        <p className="text-xs font-medium text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground">{HEALTH_LABELS[status]}</p>
      </div>
    </div>
  );
}

/* ── Main component ── */
export function ProjectOverview() {
  const { project, updateCharter, goals, addGoal, updateGoal, deleteGoal, getAllTasks } = useProject();
  const [charter, setCharter] = useState(project.charterMarkdown);
  const [saving, setSaving] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState('');

  const hasCharterChanges = charter !== project.charterMarkdown;

  const allTasks = useMemo(() => getAllTasks(), [getAllTasks]);

  const health = useMemo(() => {
    const { criticalTaskIds } = computeCriticalPath(allTasks);
    return computeProjectHealth(allTasks, criticalTaskIds);
  }, [allTasks]);

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
            <p className="text-sm text-muted-foreground">Charter, health & strategic goals</p>
          </div>
        </div>

        {/* Project Health Widget */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Project Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-8">
              <TrafficLight label="Schedule" status={health.schedule} />
              <TrafficLight label="Budget" status={health.budget} />
              <TrafficLight label="Risk" status={health.risk} />
            </div>
          </CardContent>
        </Card>

        {/* Project Charter with Write/Preview */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Project Charter</Label>
          <Tabs defaultValue="write">
            <TabsList className="h-8">
              <TabsTrigger value="write" className="text-xs px-3 py-1">Write</TabsTrigger>
              <TabsTrigger value="preview" className="text-xs px-3 py-1">Preview</TabsTrigger>
            </TabsList>
            <TabsContent value="write">
              <Textarea
                value={charter}
                onChange={e => setCharter(e.target.value)}
                placeholder="# Project Charter&#10;&#10;## Objectives&#10;- ...&#10;&#10;## Scope&#10;...&#10;&#10;## Stakeholders&#10;..."
                className="min-h-[200px] font-mono text-sm"
              />
            </TabsContent>
            <TabsContent value="preview">
              <div className="min-h-[200px] rounded-md border border-input bg-background p-4 space-y-2">
                {charter.trim()
                  ? renderMarkdown(charter)
                  : <p className="text-sm text-muted-foreground italic">Nothing to preview</p>}
              </div>
            </TabsContent>
          </Tabs>
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
