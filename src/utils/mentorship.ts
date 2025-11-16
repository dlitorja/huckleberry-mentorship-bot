import { supabase } from '../bot/supabaseClient.js';

export type MentorshipWithRelations = {
  id: string;
  sessions_remaining: number;
  total_sessions: number;
  status: string;
  last_session_date?: string | null;
  mentees?: { id: string; email: string | null; discord_id?: string | null } | null;
  instructors?: { id: string; name: string | null; discord_id?: string | null } | null;
};

export async function getMentorshipByDiscordIds(params: {
  instructorDiscordId: string;
  menteeDiscordId: string;
  status?: 'active' | 'ended';
}): Promise<{ data: MentorshipWithRelations | null; error: unknown }> {
  const { instructorDiscordId, menteeDiscordId, status } = params;

  let query = supabase
    .from('mentorships')
    .select(
      `
      id,
      sessions_remaining,
      total_sessions,
      status,
      last_session_date,
      mentees ( id, email, discord_id ),
      instructors ( id, name, discord_id )
    `
    )
    .eq('instructors.discord_id', instructorDiscordId)
    .eq('mentees.discord_id', menteeDiscordId);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query.maybeSingle();
  if (error) return { data: null, error };
  return { data: (data as MentorshipWithRelations | null) ?? null, error: null };
}

export async function getAnyMentorshipForMentee(menteeDiscordId: string): Promise<{ data: MentorshipWithRelations | null; error: unknown }> {
  const { data, error } = await supabase
    .from('mentorships')
    .select(
      `
      id,
      sessions_remaining,
      total_sessions,
      status,
      mentees ( id, email, discord_id ),
      instructors ( id, name, discord_id )
    `
    )
    .eq('mentees.discord_id', menteeDiscordId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { data: null, error };
  return { data: (data as MentorshipWithRelations | null) ?? null, error: null };
}


