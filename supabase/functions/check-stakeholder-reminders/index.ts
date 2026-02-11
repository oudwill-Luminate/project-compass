import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find all high-power stakeholders (power >= 4) overdue by 14+ days
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const cutoffDate = fourteenDaysAgo.toISOString().slice(0, 10);

    // Get overdue stakeholders with their project info
    const { data: overdueStakeholders, error: fetchErr } = await supabase
      .from('stakeholders')
      .select('id, name, role, power, last_communication_date, project_id')
      .gte('power', 4)
      .or(`last_communication_date.is.null,last_communication_date.lte.${cutoffDate}`);

    if (fetchErr) throw new Error(`Failed to fetch stakeholders: ${fetchErr.message}`);
    if (!overdueStakeholders || overdueStakeholders.length === 0) {
      return new Response(JSON.stringify({ message: 'No overdue stakeholders', sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Group by project
    const byProject = new Map<string, typeof overdueStakeholders>();
    for (const s of overdueStakeholders) {
      const list = byProject.get(s.project_id) || [];
      list.push(s);
      byProject.set(s.project_id, list);
    }

    let emailsSent = 0;

    for (const [projectId, stakeholders] of byProject) {
      // Get project owner's email
      const { data: members } = await supabase
        .from('project_members')
        .select('user_id')
        .eq('project_id', projectId)
        .eq('role', 'owner');

      if (!members || members.length === 0) continue;

      const { data: userData } = await supabase.auth.admin.getUserById(members[0].user_id);
      if (!userData?.user?.email) continue;

      const ownerEmail = userData.user.email;

      // Get project name
      const { data: proj } = await supabase
        .from('projects')
        .select('name')
        .eq('id', projectId)
        .single();

      const projectName = proj?.name || 'Your Project';

      // Build stakeholder list
      const stakeholderLines = stakeholders.map(s => {
        const lastContact = s.last_communication_date || 'Never';
        const daysAgo = s.last_communication_date
          ? Math.floor((Date.now() - new Date(s.last_communication_date).getTime()) / 86400000)
          : '∞';
        return `• <strong>${s.name}</strong> (${s.role || 'No role'}) — Power: ${s.power}/5 — Last contact: ${lastContact} (${daysAgo} days ago)`;
      }).join('<br/>');

      // Send email via Resend
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Project Manager <onboarding@resend.dev>',
          to: [ownerEmail],
          subject: `⚠️ Stakeholder Reminder: ${stakeholders.length} overdue in "${projectName}"`,
          html: `
            <h2>Stakeholder Communication Reminder</h2>
            <p>The following high-power stakeholders in <strong>${projectName}</strong> haven't been contacted in over 14 days:</p>
            <p>${stakeholderLines}</p>
            <p>Consider scheduling a check-in with these key stakeholders to maintain engagement.</p>
            <hr/>
            <p style="color: #888; font-size: 12px;">Sent by your project management tool.</p>
          `,
        }),
      });

      if (emailRes.ok) {
        emailsSent++;
      } else {
        const errBody = await emailRes.text();
        console.error(`Resend error for project ${projectId}: [${emailRes.status}] ${errBody}`);
      }
    }

    return new Response(JSON.stringify({ message: 'Reminders sent', sent: emailsSent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in stakeholder reminders:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
