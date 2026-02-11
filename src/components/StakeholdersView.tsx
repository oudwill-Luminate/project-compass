import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProject } from '@/context/ProjectContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
import { Plus, Trash2, Users2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type EngagementLevel = 'unaware' | 'resistant' | 'neutral' | 'supportive' | 'leading';

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
}

const ENGAGEMENT_CONFIG: Record<EngagementLevel, { label: string; className: string }> = {
  unaware: { label: 'Unaware', className: 'bg-muted text-muted-foreground' },
  resistant: { label: 'Resistant', className: 'bg-destructive/15 text-destructive' },
  neutral: { label: 'Neutral', className: 'bg-secondary text-secondary-foreground' },
  supportive: { label: 'Supportive', className: 'bg-primary/15 text-primary' },
  leading: { label: 'Leading', className: 'bg-accent text-accent-foreground' },
};

function PowerInterestMatrix({ stakeholders }: { stakeholders: Stakeholder[] }) {
  const quadrants = useMemo(() => {
    const highPower = stakeholders.filter(s => s.power >= 4);
    const lowPower = stakeholders.filter(s => s.power < 4);
    return {
      manageClosely: highPower.filter(s => s.interest >= 4),   // High Power, High Interest
      keepSatisfied: highPower.filter(s => s.interest < 4),    // High Power, Low Interest
      keepInformed: lowPower.filter(s => s.interest >= 4),     // Low Power, High Interest
      monitor: lowPower.filter(s => s.interest < 4),           // Low Power, Low Interest
    };
  }, [stakeholders]);

  const QuadrantCell = ({ title, items, className }: { title: string; items: Stakeholder[]; className: string }) => (
    <div className={cn('p-3 min-h-[120px] space-y-1.5', className)}>
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">{title}</p>
      {items.map(s => (
        <div key={s.id} className="text-xs font-medium bg-background/80 rounded px-2 py-1 truncate shadow-sm">
          {s.name}
        </div>
      ))}
      {items.length === 0 && <p className="text-[10px] opacity-40 italic">No stakeholders</p>}
    </div>
  );

  return (
    <div className="border rounded-xl overflow-hidden">
      <div className="grid grid-cols-[auto_1fr_1fr]">
        {/* Y-axis label */}
        <div className="row-span-3 flex items-center justify-center w-10 bg-muted/20">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground -rotate-90 whitespace-nowrap">
            Power →
          </span>
        </div>
        {/* Column headers */}
        <div className="col-span-2 text-center py-1.5 border-b bg-muted/20">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Interest →</span>
        </div>
        {/* Matrix cells */}
        <QuadrantCell title="Keep Satisfied" items={quadrants.keepSatisfied} className="border-r border-b bg-amber-500/5" />
        <QuadrantCell title="Manage Closely" items={quadrants.manageClosely} className="border-b bg-destructive/5" />
        <QuadrantCell title="Monitor" items={quadrants.monitor} className="border-r bg-muted/5" />
        <QuadrantCell title="Keep Informed" items={quadrants.keepInformed} className="bg-primary/5" />
      </div>
    </div>
  );
}

export function StakeholdersView() {
  const { project } = useProject();
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [loading, setLoading] = useState(true);

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
      })));
    }
    setLoading(false);
  }, [project.id]);

  useEffect(() => { fetchStakeholders(); }, [fetchStakeholders]);

  // Realtime
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
    // Optimistic
    setStakeholders(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.role !== undefined) dbUpdates.role = updates.role;
    if (updates.power !== undefined) dbUpdates.power = updates.power;
    if (updates.interest !== undefined) dbUpdates.interest = updates.interest;
    if (updates.engagement !== undefined) dbUpdates.engagement = updates.engagement;
    if (updates.communicationPlan !== undefined) dbUpdates.communication_plan = updates.communicationPlan;
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
      <div className="max-w-5xl mx-auto space-y-8">
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

        {/* Matrix */}
        {stakeholders.length > 0 && (
          <div>
            <Label className="text-sm font-semibold mb-3 block">Power / Interest Matrix</Label>
            <PowerInterestMatrix stakeholders={stakeholders} />
          </div>
        )}

        {/* Table */}
        <div className="border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-[180px]">Name</TableHead>
                <TableHead className="w-[140px]">Role</TableHead>
                <TableHead className="w-[80px] text-center">Power</TableHead>
                <TableHead className="w-[80px] text-center">Interest</TableHead>
                <TableHead className="w-[140px]">Engagement</TableHead>
                <TableHead>Communication Plan</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {stakeholders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No stakeholders yet. Click "Add Stakeholder" to begin.
                  </TableCell>
                </TableRow>
              )}
              {stakeholders.map(s => (
                <TableRow key={s.id}>
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
                    <Select
                      value={String(s.power)}
                      onValueChange={v => updateStakeholder(s.id, { power: Number(v) })}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-popover">
                        {[1, 2, 3, 4, 5].map(n => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={String(s.interest)}
                      onValueChange={v => updateStakeholder(s.id, { interest: Number(v) })}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-popover">
                        {[1, 2, 3, 4, 5].map(n => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={s.engagement}
                      onValueChange={(v: EngagementLevel) => updateStakeholder(s.id, { engagement: v })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        {(Object.entries(ENGAGEMENT_CONFIG) as [EngagementLevel, typeof ENGAGEMENT_CONFIG[EngagementLevel]][]).map(([key, cfg]) => (
                          <SelectItem key={key} value={key}>
                            <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', cfg.className)}>
                              {cfg.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={s.communicationPlan}
                      onChange={e => updateStakeholder(s.id, { communicationPlan: e.target.value })}
                      placeholder="e.g. Weekly Email, Monthly Board Report"
                      className="h-8 text-sm"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteStakeholder(s.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
