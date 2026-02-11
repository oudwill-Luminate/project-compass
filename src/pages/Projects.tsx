import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Folder, Plus, LogOut, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface ProjectRow {
  id: string;
  name: string;
  contingency_percent: number;
  created_by: string;
  created_at: string;
}

export default function Projects() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setProjects(data as ProjectRow[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newName.trim()) return;
    setCreating(true);

    const { data, error } = await supabase
      .from('projects')
      .insert({ name: newName.trim(), created_by: user.id })
      .select()
      .single();

    if (error) {
      toast.error(error.message);
    } else if (data) {
      // Create default buckets
      const defaultBuckets = [
        { project_id: (data as ProjectRow).id, name: 'Planning', color: '#0073EA', position: 0 },
        { project_id: (data as ProjectRow).id, name: 'In Progress', color: '#00C875', position: 1 },
        { project_id: (data as ProjectRow).id, name: 'Review', color: '#A25DDC', position: 2 },
        { project_id: (data as ProjectRow).id, name: 'Done', color: '#FDAB3D', position: 3 },
      ];
      await supabase.from('buckets').insert(defaultBuckets);

      toast.success('Project created!');
      setDialogOpen(false);
      setNewName('');
      navigate(`/project/${(data as ProjectRow).id}`);
    }
    setCreating(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <Folder className="w-4 h-4 text-primary-foreground" />
            </div>
            <h1 className="font-bold text-lg">ProjectFlow</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {profile?.display_name || user?.email}
            </span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Your Projects</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Select a project or create a new one
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" /> New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-background">
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
              </DialogHeader>
              <form onSubmit={createProject} className="space-y-4 mt-2">
                <div>
                  <Label className="text-xs font-medium">Project Name</Label>
                  <Input
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="e.g. Software Launch v2.0"
                    required
                    className="mt-1"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Project'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20 border rounded-2xl bg-muted/10">
            <Folder className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-lg font-medium text-foreground">No projects yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Create your first project to get started
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Create Project
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(project => (
              <button
                key={project.id}
                onClick={() => navigate(`/project/${project.id}`)}
                className="text-left p-5 rounded-xl border bg-card hover:shadow-md hover:border-primary/30 transition-all"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Folder className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="font-bold text-sm text-foreground truncate">{project.name}</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Contingency: {project.contingency_percent}%
                </p>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
