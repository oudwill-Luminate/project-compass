import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProject } from '@/context/ProjectContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Plus, Trash2, Users2, MessageSquare, CalendarIcon, AlertTriangle, TrendingUp, Info } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, differenceInDays, parseISO, subDays } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

type EngagementLevel = 'unaware' | 'resistant' | 'neutral' | 'supportive' | 'leading';
type Sentiment = 'positive' | 'neutral' | 'negative';

interface Stakeholder {
  id: string;
  projectId: string;
  name: string;
  role: string;
  power: number;
  interest: number;
  engagement: EngagementLevel;
  communicationPlan: string;
  position: number;
  sentiment: Sentiment;
  lastCommunicationDate: string | null;
}

interface CommunicationLog {
  id: string;
  stakeholderId: string;
  note: string;
  loggedAt: string;
}

interface SentimentHistoryPoint {
  date: string;
  positive: number;
  neutral: number;
  negative: number;
}

const ENGAGEMENT_CONFIG: Record<EngagementLevel, { label: string; className: string }> = {
  unaware: { label: 'Unaware', className: 'bg-muted text-muted-foreground' },
  resistant: { label: 'Resistant', className: 'bg-destructive/15 text-destructive' },
  neutral: { label: 'Neutral', className: 'bg-secondary text-secondary-foreground' },
  supportive: { label: 'Supportive', className: 'bg-primary/15 text-primary' },
  leading: { label: 'Leading', className: 'bg-accent text-accent-foreground' },
};

const SENTIMENT_CONFIG: Record<Sentiment, { label: string; border: string; dot: string }> = {
  positive: { label: 'Positive', border: 'ring-2 ring-green-500', dot: 'bg-green-500' },
  neutral: { label: 'Neutral', border: 'ring-2 ring-muted-foreground/30', dot: 'bg-muted-foreground' },
  negative: { label: 'Negative', border: 'ring-2 ring-red-500', dot: 'bg-red-500' },
};

const POWER_LABELS: Record<number, string> = {
  1: 'Minimal: No authority over project decisions',
  2: 'Low: Can influence minor decisions',
  3: 'Moderate: Controls some resources or approvals',
  4: 'High: Key decision-maker or budget holder',
  5: 'Critical: Executive sponsor or veto power',
};

const INTEREST_LABELS: Record<number, string> = {
  1: 'Minimal: Unaffected by project outcomes',
  2: 'Low: Peripherally aware',
  3: 'Moderate: Somewhat affected by results',
  4: 'High: Directly impacted by deliverables',
  5: 'Critical: Core dependency on project success',
};

const POWER_SHORT: Record<number, string> = { 1: 'Minimal', 2: 'Low', 3: 'Moderate', 4: 'High', 5: 'Critical' };
const INTEREST_SHORT: Record<number, string> = { 1: 'Minimal', 2: 'Low', 3: 'Moderate', 4: 'High', 5: 'Critical' };

const COMM_PLAN_OPTIONS = [
  'Weekly Email Update',
  'Bi-Weekly Meeting',
  'Monthly Report',
  'Quarterly Review',
  'Ad-Hoc / As Needed',
  'Daily Standup',
  'Steering Committee',
];

const SENTINEL_OTHER = '__other__';

const MATRIX_LEGEND = [
  { title: 'Manage Closely', desc: 'High Power, High Interest — Active engagement, frequent communication', className: 'bg-destructive/10 text-destructive' },
  { title: 'Keep Satisfied', desc: 'High Power, Low Interest — Address concerns, avoid overload', className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  { title: 'Keep Informed', desc: 'Low Power, High Interest — Regular updates, leverage as advocates', className: 'bg-primary/10 text-primary' },
  { title: 'Monitor', desc: 'Low Power, Low Interest — Minimal effort, periodic check-ins', className: 'bg-muted text-muted-foreground' },
];

/* ── Helper: overdue check ── */

/* ── Helper: overdue check ── */
function isOverdue(s: Stakeholder): boolean {
  if (s.power < 4) return false;
  if (!s.lastCommunicationDate) return true;
  return differenceInDays(new Date(), parseISO(s.lastCommunicationDate)) > 14;
}

/* ── Matrix ── */
function PowerInterestMatrix({ stakeholders }: { stakeholders: Stakeholder[] }) {
  const quadrants = useMemo(() => {
    const highPower = stakeholders.filter(s => s.power >= 4);
    const lowPower = stakeholders.filter(s => s.power < 4);
    return {
      manageClosely: highPower.filter(s => s.interest >= 4),
      keepSatisfied: highPower.filter(s => s.interest < 4),
      keepInformed: lowPower.filter(s => s.interest >= 4),
      monitor: lowPower.filter(s => s.interest < 4),
    };
  }, [stakeholders]);

  const QuadrantCell = ({ title, items, className }: { title: string; items: Stakeholder[]; className: string }) => (
    <div className={cn('p-3 min-h-[120px] space-y-1.5', className)}>
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">{title}</p>
      {items.map(s => {
        const sentCfg = SENTIMENT_CONFIG[s.sentiment];
        const overdue = isOverdue(s);
        return (
          <div
            key={s.id}
            className={cn(
              'text-xs font-medium bg-background/80 rounded px-2 py-1 truncate shadow-sm flex items-center gap-1.5',
              sentCfg.border,
              overdue && 'bg-yellow-100 dark:bg-yellow-900/30',
            )}
          >
            <div className={cn('w-2 h-2 rounded-full shrink-0', sentCfg.dot)} />
            {s.name}
            {overdue && <AlertTriangle className="w-3 h-3 text-yellow-600 shrink-0" />}
          </div>
        );
      })}
      {items.length === 0 && <p className="text-[10px] opacity-40 italic">No stakeholders</p>}
    </div>
  );

  return (
    <div className="border rounded-xl overflow-hidden">
      <div className="grid grid-cols-[auto_1fr_1fr]">
        <div className="row-span-3 flex items-center justify-center w-10 bg-muted/20">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground -rotate-90 whitespace-nowrap">
            Power →
          </span>
        </div>
        <div className="col-span-2 text-center py-1.5 border-b bg-muted/20">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Interest →</span>
        </div>
        <QuadrantCell title="Keep Satisfied" items={quadrants.keepSatisfied} className="border-r border-b bg-amber-500/5" />
        <QuadrantCell title="Manage Closely" items={quadrants.manageClosely} className="border-b bg-destructive/5" />
        <QuadrantCell title="Monitor" items={quadrants.monitor} className="border-r bg-muted/5" />
        <QuadrantCell title="Keep Informed" items={quadrants.keepInformed} className="bg-primary/5" />
      </div>
    </div>
  );
}

/* ── Sentiment History Chart ── */
function SentimentHistoryChart({ projectId }: { projectId: string }) {
  const [chartData, setChartData] = useState<SentimentHistoryPoint[]>([]);

  useEffect(() => {
    async function fetchHistory() {
      const { data } = await supabase
        .from('stakeholder_sentiment_history' as any)
        .select('sentiment, recorded_at, stakeholder_id')
        .order('recorded_at');

      if (!data || data.length === 0) {
        setChartData([]);
        return;
      }

      // Filter to stakeholders belonging to this project
      const { data: projectStakeholders } = await supabase
        .from('stakeholders' as any)
        .select('id')
        .eq('project_id', projectId);

      const projectIds = new Set((projectStakeholders as any[] || []).map((s: any) => s.id));
      const filtered = (data as any[]).filter(d => projectIds.has(d.stakeholder_id));

      // Group by date
      const byDate = new Map<string, { positive: number; neutral: number; negative: number }>();
      for (const entry of filtered) {
        const date = entry.recorded_at;
        if (!byDate.has(date)) byDate.set(date, { positive: 0, neutral: 0, negative: 0 });
        const bucket = byDate.get(date)!;
        const s = entry.sentiment as Sentiment;
        if (s === 'positive') bucket.positive++;
        else if (s === 'negative') bucket.negative++;
        else bucket.neutral++;
      }

      const points = Array.from(byDate.entries())
        .map(([date, counts]) => ({ date, ...counts }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setChartData(points);
    }
    fetchHistory();
  }, [projectId]);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Sentiment Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-6">
            No sentiment history yet. Change stakeholder sentiments to start tracking trends.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          Sentiment Trends
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickFormatter={v => format(parseISO(v), 'MMM d')}
              />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <RechartsTooltip
                labelFormatter={v => format(parseISO(v as string), 'PPP')}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Line type="monotone" dataKey="positive" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} name="Positive" />
              <Line type="monotone" dataKey="neutral" stroke="#9ca3af" strokeWidth={2} dot={{ r: 3 }} name="Neutral" />
              <Line type="monotone" dataKey="negative" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} name="Negative" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Communication Log Dialog ── */
function CommLogDialog({
  stakeholder,
  open,
  onOpenChange,
}: {
  stakeholder: Stakeholder;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [logs, setLogs] = useState<CommunicationLog[]>([]);
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchLogs = useCallback(async () => {
    const { data } = await supabase
      .from('communication_logs' as any)
      .select('*')
      .eq('stakeholder_id', stakeholder.id)
      .order('logged_at', { ascending: false });
    if (data) {
      setLogs((data as any[]).map(l => ({
        id: l.id,
        stakeholderId: l.stakeholder_id,
        note: l.note,
        loggedAt: l.logged_at,
      })));
    }
  }, [stakeholder.id]);

  useEffect(() => {
    if (open) fetchLogs();
  }, [open, fetchLogs]);

  const addLog = async () => {
    if (!newNote.trim()) return;
    setSaving(true);
    const now = new Date().toISOString();
    await supabase.from('communication_logs' as any).insert({
      stakeholder_id: stakeholder.id,
      note: newNote.trim(),
      logged_at: now,
    } as any);
    await supabase
      .from('stakeholders' as any)
      .update({ last_communication_date: now.slice(0, 10) } as any)
      .eq('id', stakeholder.id);
    setNewNote('');
    setSaving(false);
    fetchLogs();
    toast.success('Log entry added');
  };

  const deleteLog = async (logId: string) => {
    await supabase.from('communication_logs' as any).delete().eq('id', logId);
    fetchLogs();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">Communication Log — {stakeholder.name}</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2">
          <Textarea
            value={newNote}
            onChange={e => setNewNote(e.target.value)}
            placeholder="Record a meeting note or interaction…"
            className="text-sm min-h-[60px]"
          />
          <Button onClick={addLog} size="sm" disabled={!newNote.trim() || saving} className="self-end">
            Add
          </Button>
        </div>
        <div className="flex-1 overflow-auto space-y-2 mt-2">
          {logs.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No entries yet.</p>
          )}
          {logs.map(log => (
            <div key={log.id} className="p-3 border rounded-lg bg-muted/20 space-y-1 group relative">
              <p className="text-[11px] text-muted-foreground">
                {format(new Date(log.loggedAt), 'PPP p')}
              </p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{log.note}</p>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                onClick={() => deleteLog(log.id)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Main ── */
export function StakeholdersView() {
  const { project } = useProject();
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [logDialogStakeholder, setLogDialogStakeholder] = useState<Stakeholder | null>(null);
  const [chartKey, setChartKey] = useState(0); // force chart refresh

  const fetchStakeholders = useCallback(async () => {
    const { data } = await supabase
      .from('stakeholders' as any)
      .select('*')
      .eq('project_id', project.id)
      .order('position');
    if (data) {
      setStakeholders((data as any[]).map(s => ({
        id: s.id,
        projectId: s.project_id,
        name: s.name,
        role: s.role,
        power: s.power,
        interest: s.interest,
        engagement: s.engagement as EngagementLevel,
        communicationPlan: s.communication_plan,
        position: s.position,
        sentiment: (s.sentiment || 'neutral') as Sentiment,
        lastCommunicationDate: s.last_communication_date,
      })));
    }
    setLoading(false);
  }, [project.id]);

  useEffect(() => { fetchStakeholders(); }, [fetchStakeholders]);

  useEffect(() => {
    const channel = supabase
      .channel(`stakeholders-${project.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stakeholders', filter: `project_id=eq.${project.id}` }, () => fetchStakeholders())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [project.id, fetchStakeholders]);

  const addStakeholder = async () => {
    const position = stakeholders.length;
    await supabase.from('stakeholders' as any).insert({
      project_id: project.id,
      name: 'New Stakeholder',
      role: '',
      position,
    } as any);
  };

  const updateStakeholder = async (id: string, updates: Partial<Stakeholder>) => {
    setStakeholders(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.role !== undefined) dbUpdates.role = updates.role;
    if (updates.power !== undefined) dbUpdates.power = updates.power;
    if (updates.interest !== undefined) dbUpdates.interest = updates.interest;
    if (updates.engagement !== undefined) dbUpdates.engagement = updates.engagement;
    if (updates.communicationPlan !== undefined) dbUpdates.communication_plan = updates.communicationPlan;
    if (updates.lastCommunicationDate !== undefined) dbUpdates.last_communication_date = updates.lastCommunicationDate;

    if (updates.sentiment !== undefined) {
      dbUpdates.sentiment = updates.sentiment;
      // Log sentiment change to history
      await supabase.from('stakeholder_sentiment_history' as any).insert({
        stakeholder_id: id,
        sentiment: updates.sentiment,
        recorded_at: new Date().toISOString().slice(0, 10),
      } as any);
      setChartKey(k => k + 1);
    }

    await supabase.from('stakeholders' as any).update(dbUpdates).eq('id', id);
  };

  const deleteStakeholder = async (id: string) => {
    setStakeholders(prev => prev.filter(s => s.id !== id));
    await supabase.from('stakeholders' as any).delete().eq('id', id);
    toast.success('Stakeholder removed');
  };

  if (loading) return <div className="flex-1 flex items-center justify-center text-muted-foreground">Loading…</div>;

  return (
    <div className="flex-1 overflow-auto p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <Users2 className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Stakeholders</h2>
              <p className="text-sm text-muted-foreground">Track influence, interest & communication</p>
            </div>
          </div>
          <Button onClick={addStakeholder} size="sm">
            <Plus className="w-4 h-4 mr-1" /> Add Stakeholder
          </Button>
        </div>

        {/* Matrix + Chart side by side */}
        {stakeholders.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-semibold mb-3 block">Power / Interest Matrix</Label>
                <PowerInterestMatrix stakeholders={stakeholders} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {MATRIX_LEGEND.map(q => (
                  <div key={q.title} className={cn('rounded-lg px-3 py-2', q.className)}>
                    <p className="text-xs font-semibold">{q.title}</p>
                    <p className="text-[10px] opacity-80">{q.desc}</p>
                  </div>
                ))}
              </div>
            </div>
            <SentimentHistoryChart key={chartKey} projectId={project.id} />
          </div>
        )}

        {/* Table */}
        <div className="border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-[160px]">Name</TableHead>
                <TableHead className="w-[120px]">Role</TableHead>
                <TableHead className="w-[90px] text-center">
                  <TooltipProvider>
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center gap-1 cursor-help">Power <Info className="w-3 h-3 text-muted-foreground" /></span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[220px] text-xs space-y-1">
                        {Object.entries(POWER_LABELS).map(([k, v]) => <p key={k}><strong>{k}</strong> — {v.split(': ')[1]}</p>)}
                      </TooltipContent>
                    </UITooltip>
                  </TooltipProvider>
                </TableHead>
                <TableHead className="w-[90px] text-center">
                  <TooltipProvider>
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center gap-1 cursor-help">Interest <Info className="w-3 h-3 text-muted-foreground" /></span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[220px] text-xs space-y-1">
                        {Object.entries(INTEREST_LABELS).map(([k, v]) => <p key={k}><strong>{k}</strong> — {v.split(': ')[1]}</p>)}
                      </TooltipContent>
                    </UITooltip>
                  </TooltipProvider>
                </TableHead>
                <TableHead className="w-[120px]">Engagement</TableHead>
                <TableHead className="w-[110px]">Sentiment</TableHead>
                <TableHead className="w-[140px]">Last Contact</TableHead>
                <TableHead>Comm. Plan</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {stakeholders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    No stakeholders yet. Click "Add Stakeholder" to begin.
                  </TableCell>
                </TableRow>
              )}
              {stakeholders.map(s => {
                const overdue = isOverdue(s);
                return (
                  <TableRow key={s.id} className={cn(overdue && 'bg-yellow-50 dark:bg-yellow-950/20')}>
                    <TableCell>
                      <Input
                        value={s.name}
                        onChange={e => updateStakeholder(s.id, { name: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={s.role}
                        onChange={e => updateStakeholder(s.id, { role: e.target.value })}
                        placeholder="e.g. Sponsor"
                        className="h-8 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Select value={String(s.power)} onValueChange={v => updateStakeholder(s.id, { power: Number(v) })}>
                        <SelectTrigger className="h-8 text-xs w-[90px]"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-popover">
                          {[1, 2, 3, 4, 5].map(n => (
                            <SelectItem key={n} value={String(n)}>
                              <span className="text-xs">{n} - {POWER_SHORT[n]}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={String(s.interest)} onValueChange={v => updateStakeholder(s.id, { interest: Number(v) })}>
                        <SelectTrigger className="h-8 text-xs w-[90px]"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-popover">
                          {[1, 2, 3, 4, 5].map(n => (
                            <SelectItem key={n} value={String(n)}>
                              <span className="text-xs">{n} - {INTEREST_SHORT[n]}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={s.engagement} onValueChange={(v: EngagementLevel) => updateStakeholder(s.id, { engagement: v })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-popover">
                          {(Object.entries(ENGAGEMENT_CONFIG) as [EngagementLevel, typeof ENGAGEMENT_CONFIG[EngagementLevel]][]).map(([key, cfg]) => (
                            <SelectItem key={key} value={key}>
                              <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', cfg.className)}>{cfg.label}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={s.sentiment} onValueChange={(v: Sentiment) => updateStakeholder(s.id, { sentiment: v })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-popover">
                          {(Object.entries(SENTIMENT_CONFIG) as [Sentiment, typeof SENTIMENT_CONFIG[Sentiment]][]).map(([key, cfg]) => (
                            <SelectItem key={key} value={key}>
                              <span className="flex items-center gap-1.5">
                                <span className={cn('w-2 h-2 rounded-full', cfg.dot)} />
                                <span className="text-[10px] font-medium">{cfg.label}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              'h-8 text-xs justify-start font-normal w-full',
                              !s.lastCommunicationDate && 'text-muted-foreground',
                              overdue && 'border-yellow-500 text-yellow-700 dark:text-yellow-400',
                            )}
                          >
                            <CalendarIcon className="w-3 h-3 mr-1 shrink-0" />
                            {s.lastCommunicationDate
                              ? format(parseISO(s.lastCommunicationDate), 'MMM d')
                              : 'Set date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={s.lastCommunicationDate ? parseISO(s.lastCommunicationDate) : undefined}
                            onSelect={d => {
                              if (d) updateStakeholder(s.id, { lastCommunicationDate: format(d, 'yyyy-MM-dd') });
                            }}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const isOther = s.communicationPlan && !COMM_PLAN_OPTIONS.includes(s.communicationPlan);
                        const selectValue = isOther ? SENTINEL_OTHER : (s.communicationPlan || '');
                        return (
                          <div className="space-y-1">
                            <Select
                              value={selectValue}
                              onValueChange={v => {
                                if (v === SENTINEL_OTHER) {
                                  updateStakeholder(s.id, { communicationPlan: '' });
                                } else {
                                  updateStakeholder(s.id, { communicationPlan: v });
                                }
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select plan…" /></SelectTrigger>
                              <SelectContent className="bg-popover">
                                {COMM_PLAN_OPTIONS.map(opt => (
                                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                ))}
                                <SelectItem value={SENTINEL_OTHER}>Other (custom)</SelectItem>
                              </SelectContent>
                            </Select>
                            {(selectValue === SENTINEL_OTHER || isOther) && (
                              <Input
                                value={s.communicationPlan}
                                onChange={e => updateStakeholder(s.id, { communicationPlan: e.target.value })}
                                placeholder="Custom plan…"
                                className="h-7 text-xs"
                              />
                            )}
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-primary"
                          onClick={() => setLogDialogStakeholder(s)}
                          title="Communication Log"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteStakeholder(s.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {logDialogStakeholder && (
        <CommLogDialog
          stakeholder={logDialogStakeholder}
          open={!!logDialogStakeholder}
          onOpenChange={v => { if (!v) setLogDialogStakeholder(null); }}
        />
      )}
    </div>
  );
}
