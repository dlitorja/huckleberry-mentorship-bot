import { getSupabaseClient } from "./supabase";

export type UserRole = "student" | "instructor" | "admin" | "unknown";

export async function getUserRoleByDiscordId(discordId: string): Promise<UserRole> {
  const supabase = getSupabaseClient(true);

  // If supabase client is a mock (CI environment), return unknown
  if (!supabase || typeof supabase.from !== 'function') {
    return "unknown";
  }

  // Check admin
  if (process.env.ADMIN_DISCORD_ID && process.env.ADMIN_DISCORD_ID === discordId) {
    return "admin";
  }

  // Check instructors table
  try {
    const { data: instructor } = await supabase
      .from("instructors")
      .select("id")
      .eq("discord_id", discordId)
      .maybeSingle();
    if (instructor) return "instructor";
  } catch (error) {
    // In CI/build environment, supabase might be a mock
    console.warn("[Auth] Failed to check instructors table:", error);
  }

  // Check mentees table
  try {
    const { data: mentee } = await supabase
      .from("mentees")
      .select("id")
      .eq("discord_id", discordId)
      .maybeSingle();
    if (mentee) return "student";
  } catch (error) {
    // In CI/build environment, supabase might be a mock
    console.warn("[Auth] Failed to check mentees table:", error);
  }

  return "unknown";
}

export function assertRole(role: UserRole, allowed: UserRole[]) {
  if (!allowed.includes(role)) {
    throw new Error("Forbidden");
  }
}
