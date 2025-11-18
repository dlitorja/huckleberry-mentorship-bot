import NextAuth, { type NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth/next";
import DiscordProvider from "next-auth/providers/discord";
import { getUserRoleByDiscordId } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";
import { JWT } from "next-auth/jwt";
import { Account, Profile, Session } from "next-auth";

// Lazy check - only validate env vars when actually creating authOptions (not during build)
function getAuthOptions(): NextAuthOptions {
  // During Next.js build, env vars may not be available
  // Use placeholder values during build to prevent errors
  // Runtime validation happens in the auth() function
  const isBuild = !!process.env.NEXT_PHASE;
  
  const clientId = process.env.DISCORD_CLIENT_ID || (isBuild ? "build-placeholder" : "");
  const clientSecret = process.env.DISCORD_CLIENT_SECRET || (isBuild ? "build-placeholder" : "");

  return {
    providers: [
      DiscordProvider({
        clientId,
        clientSecret,
      }),
    ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, account, profile }: { token: JWT; account: Account | null; profile?: Profile }) {
      if (account && profile && "id" in profile) {
        const discordId = String((profile as any).id);
        const discordUsername = (profile as any).username ? `@${(profile as any).username}` : null;
        
        token.discordId = discordId;
        token.discordUsername = discordUsername;
        const role = await getUserRoleByDiscordId(discordId);
        token.role = role;
        
        // Update discord_username in database if it's different or null
        if (discordUsername) {
          try {
            const supabase = getSupabaseClient(true);
            if (role === "student") {
              // Update mentee's discord_username
              await supabase
                .from("mentees")
                .update({ discord_username: discordUsername })
                .eq("discord_id", discordId);
            } else if (role === "instructor") {
              // Instructors table might not have discord_username, but update if it does
              // (This is a no-op if the column doesn't exist, which is fine)
              await supabase
                .from("instructors")
                .update({ discord_username: discordUsername })
                .eq("discord_id", discordId)
                .then(() => {}) // Ignore errors if column doesn't exist
                .catch(() => {}); // Silently fail if column doesn't exist
            }
          } catch (error) {
            // Log but don't fail authentication if database update fails
            console.error("[Auth] Failed to update discord_username:", error);
          }
        }
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user && token.discordId) {
        // Set user.id to Discord ID (this is what API routes expect)
        (session.user as any).id = token.discordId;
        (session.user as any).discordId = token.discordId;
        // Use role from token instead of re-fetching (already set in JWT callback)
        (session.user as any).role = token.role;
      }
      // Also set role at session level for backward compatibility
      (session as any).role = token.role;
      (session as any).discordId = token.discordId;
      return session;
    },
  },
    pages: {
      signIn: "/login",
      error: "/login",
    },
  };
}

// Export authOptions as a getter to avoid executing during build
export const authOptions: NextAuthOptions = getAuthOptions();

// Export auth function for server-side usage (wrapper around getServerSession)
export async function auth() {
  // Validate env vars at runtime when auth is actually used
  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
    throw new Error("Missing Discord client ID or secret");
  }
  return await getServerSession(authOptions);
}
