// lib/agora/validate-mentorship.ts
// Validate mentorship access for video calls

import { getSupabaseClient } from '@/lib/supabase';

export type MentorshipAccessResult = {
  hasAccess: boolean;
  isInstructor: boolean;
  isMentee: boolean;
  mentorshipId: string;
  instructorId?: string;
  menteeId?: string;
};

/**
 * Validate that a user has access to a mentorship for video calling
 * @param discordId - The Discord ID of the user
 * @param mentorshipId - The mentorship ID to check access for
 * @returns Access result with role information
 */
export async function validateMentorshipAccess(
  discordId: string,
  mentorshipId: string
): Promise<MentorshipAccessResult> {
  const supabase = getSupabaseClient(true);

  // First, get the mentorship to check if it exists
  const { data: mentorship, error: mentorshipError } = await supabase
    .from('mentorships')
    .select('id, instructor_id, mentee_id, status')
    .eq('id', mentorshipId)
    .maybeSingle();

  if (mentorshipError || !mentorship) {
    return {
      hasAccess: false,
      isInstructor: false,
      isMentee: false,
      mentorshipId,
    };
  }

  // Check if mentorship is active
  if (mentorship.status !== 'active') {
    return {
      hasAccess: false,
      isInstructor: false,
      isMentee: false,
      mentorshipId,
    };
  }

  // Get instructor Discord ID
  const { data: instructor, error: instructorError } = await supabase
    .from('instructors')
    .select('id, discord_id')
    .eq('id', mentorship.instructor_id)
    .maybeSingle();

  // Get mentee Discord ID
  const { data: mentee, error: menteeError } = await supabase
    .from('mentees')
    .select('id, discord_id')
    .eq('id', mentorship.mentee_id)
    .maybeSingle();

  if (instructorError || menteeError) {
    return {
      hasAccess: false,
      isInstructor: false,
      isMentee: false,
      mentorshipId,
    };
  }

  // Check if user is the instructor
  const isInstructor = instructor?.discord_id === discordId;
  // Check if user is the mentee
  const isMentee = mentee?.discord_id === discordId;

  return {
    hasAccess: isInstructor || isMentee,
    isInstructor,
    isMentee,
    mentorshipId,
    instructorId: instructor?.id,
    menteeId: mentee?.id,
  };
}

