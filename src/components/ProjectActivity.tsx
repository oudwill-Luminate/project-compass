import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProject } from '@/context/ProjectContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Clock, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ActivityEntry {
  id: string;
  description: string;
  created_at: string;
  task_id: string | null;
  user_id: string;
  profile?: { display_name: string; avatar_url: string | null };
}

const PAGE_SIZE = 50;

export function ProjectActivity() {
  const { project } = useProject();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);

  const fetchEntries = useCallback(async (offset = 0, append = false) => {
    if (!project.id) return;
    const { data } = await supabase
      .from('activity_log')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (!data) { setLoading(false); return; }

    // Fetch profiles for user_ids
    const userIds = [...new Set(data.map((d: any) => d.user_id))];
    const profileMap: Record<string, { display_name: string; avatar_url: string | null }> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', userIds);
      (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });
    }

    const mapped: ActivityEntry[] = data.map((d: any) => ({
      ...d,
      profile: profileMap[d.user_id],
    }));

    setEntries(prev => append ? [...prev, ...mapped] : mapped);
    setHasMore(data.length === PAGE_SIZE);
    setLoading(false);
  }, [project.id]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // Realtime subscription
  useEffect(() => {
    if (!project.id) return;
    const channel = supabase
      .channel(`activity-${project.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'activity_log',
        filter: `project_id=eq.${project.id}`,
      }, () => fetchEntries())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [project.id, fetchEntries]);

  const initials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-6 overflow-hidden">
      <div className="flex items-center gap-3 mb-6">
        <Clock className="w-5 h-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Activity Log</h2>
      </div>

      <ScrollArea className="flex-1">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No activity yet. Changes to task deadlines, costs, and statuses will appear here.
          </p>
        ) : (
          <div className="space-y-1">
            {entries.map(entry => (
              <div key={entry.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                <Avatar className="w-7 h-7 mt-0.5 shrink-0">
                  {entry.profile?.avatar_url && <AvatarImage src={entry.profile.avatar_url} />}
                  <AvatarFallback className="text-[10px] font-semibold bg-primary/10 text-primary">
                    {initials(entry.profile?.display_name || 'U')}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug">{entry.description}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}

            {hasMore && (
              <div className="pt-2 pb-4 text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchEntries(entries.length, true)}
                >
                  Load more
                </Button>
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
