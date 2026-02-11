import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '@/context/ProjectContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Settings, Trash2 } from 'lucide-react';

export function ProjectSettings() {
  const { project, updateProjectName, updateContingency, updateIncludeWeekends, deleteProject, members } = useProject();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(project.name);
  const [contingency, setContingency] = useState(String(project.contingencyPercent));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Hourly rate for current user
  const currentMember = members.find(m => m.user_id === user?.id);
  const [hourlyRate, setHourlyRate] = useState(String(currentMember?.profile?.hourly_rate || 0));
  const [savingRate, setSavingRate] = useState(false);

  const hasChanges = name !== project.name || contingency !== String(project.contingencyPercent);

  const handleSave = async () => {
    const pct = Math.min(100, Math.max(0, Number(contingency) || 0));
    setSaving(true);
    try {
      if (name !== project.name) await updateProjectName(name.trim());
      if (pct !== project.contingencyPercent) await updateContingency(pct);
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteProject();
      toast.success('Project deleted');
      navigate('/');
    } catch {
      toast.error('Failed to delete project');
      setDeleting(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-8">
      <div className="max-w-lg mx-auto space-y-8">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <Settings className="w-4 h-4 text-primary-foreground" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Project Settings</h2>
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="project-name">Project Name</Label>
            <Input
              id="project-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Project name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contingency">Contingency %</Label>
            <Input
              id="contingency"
              type="number"
              min={0}
              max={100}
              value={contingency}
              onChange={e => setContingency(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Applied as a buffer to the total project budget.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="include-weekends">Include Weekends</Label>
              <p className="text-xs text-muted-foreground">
                When enabled, Saturdays and Sundays are treated as working days for scheduling.
              </p>
            </div>
            <Switch
              id="include-weekends"
              checked={project.includeWeekends}
              onCheckedChange={(checked) => updateIncludeWeekends(checked)}
            />
          </div>

          <Button onClick={handleSave} disabled={!hasChanges || saving || !name.trim()}>
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>

        {/* Hourly Rate */}
        {user && (
          <div className="space-y-2 border-t border-border pt-6">
            <h3 className="text-sm font-semibold">Your Hourly Rate</h3>
            <p className="text-xs text-muted-foreground">
              Used to auto-calculate estimated cost when effort hours are set and no manual cost is entered.
            </p>
            <div className="flex gap-2 items-end">
              <div className="space-y-1">
                <Label htmlFor="hourly-rate">Hourly Rate ($)</Label>
                <Input
                  id="hourly-rate"
                  type="number"
                  min={0}
                  step={0.01}
                  value={hourlyRate}
                  onChange={e => setHourlyRate(e.target.value)}
                  className="w-40"
                />
              </div>
              <Button
                size="sm"
                disabled={savingRate}
                onClick={async () => {
                  setSavingRate(true);
                  try {
                    await supabase.from('profiles').update({ hourly_rate: Number(hourlyRate) } as any).eq('id', user.id);
                    toast.success('Hourly rate saved');
                  } catch {
                    toast.error('Failed to save rate');
                  } finally {
                    setSavingRate(false);
                  }
                }}
              >
                {savingRate ? 'Saving…' : 'Save Rate'}
              </Button>
            </div>
          </div>
        )}

        <div className="border-t border-border pt-6 space-y-3">
          <h3 className="text-sm font-semibold text-destructive">Danger Zone</h3>
          <p className="text-sm text-muted-foreground">
            Deleting a project removes all buckets, tasks, and members permanently.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="w-4 h-4 mr-1" />
                Delete Project
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete "{project.name}"?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. All buckets, tasks, and member associations will be permanently removed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={deleting}>
                  {deleting ? 'Deleting…' : 'Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
