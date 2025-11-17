import { getSupabaseClient } from "./supabase";

export type UserRole = "student" | "instructor" | "admin" | "unknown";

export async function getUserRoleByDiscordId(discordId: string): Promise<UserRole> {
  const supabase = getSupabaseClient(true);

  // Check admin
  if (process.env.ADMIN_DISCORD_ID && process.env.ADMIN_DISCORD_ID === discordId) {
    return "admin";
  }

  // Check instructors table
  const { data: instructor } = await supabase
    .from("instructors")
    .select("id")
    .eq("discord_id", discordId)
    .maybeSingle();
  if (instructor) return "instructor";

  // Check mentees table
  const { data: mentee } = await supabase
    .from("mentees")
    .select("id")
    .eq("discord_id", discordId)
    .maybeSingle();
  if (mentee) return "student";

  return "unknown";
}

export function assertRole(role: UserRole, allowed: UserRole[]) {
  if (!allowed.includes(role)) {
    throw new Error("Forbidden");
  }
}

