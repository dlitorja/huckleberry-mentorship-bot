import NextAuth, { type NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth/next";
import DiscordProvider from "next-auth/providers/discord";
import { getUserRoleByDiscordId } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";
import { JWT } from "next-auth/jwt";
import { Account, Profile, Session } from "next-auth";
import { ENV_CONFIG } from "@/src/config/environment";

// Check if environment is properly configured
function isEnvironmentConfigured(): boolean {
  return !!(
    ENV_CONFIG.NEXT_PUBLIC_DISCORD_CLIENT_ID && 
    ENV_CONFIG.DISCORD_CLIENT_SECRET
  );
}

function getAuthOptions(): NextAuthOptions {
  // Check if we're in a CI/build environment
  const isBuild = !!process.env.NEXT_PHASE || (process.env.NODE_ENV === 'development' && !isEnvironmentConfigured());

  if (!isEnvironmentConfigured() && !isBuild) {
    throw new Error("Missing Discord client ID or secret");
  }

  // Use placeholder values during build to prevent errors
  const clientId = ENV_CONFIG.NEXT_PUBLIC_DISCORD_CLIENT_ID || "build-placeholder";
  const clientSecret = ENV_CONFIG.DISCORD_CLIENT_SECRET || "build-placeholder";

  const options: NextAuthOptions = {
    providers: [],
    secret: ENV_CONFIG.NEXTAUTH_SECRET,
    callbacks: {
      async jwt({ token, account, profile }: { token: JWT; account: Account | null; profile?: Profile }) {
        if (!isEnvironmentConfigured()) {
          // In CI/build environment, return mock token
          return token;
        }
        
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
        if (!isEnvironmentConfigured()) {
          // In CI/build environment, return mock session
          return session;
        }
        
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

  // Only add Discord provider if credentials are available
  if (isEnvironmentConfigured()) {
    options.providers.push(
      DiscordProvider({
        clientId,
        clientSecret,
        authorization: {
          params: {
            scope: 'identify email guilds',
          },
        },
      })
    );
  }

  return options;
}

// Export authOptions as a getter to avoid executing during build
export const authOptions: NextAuthOptions = getAuthOptions();

// Export auth function for server-side usage (wrapper around getServerSession)
export async function auth() {
  if (!isEnvironmentConfigured()) {
    // In CI/build environment, return null or mock session
    if (process.env.CI || process.env.NODE_ENV === 'development') {
      console.warn('Auth not configured - returning null session for CI');
      return null; 
    }
    throw new Error("Missing Discord client ID or secret");
  }
  
  return await getServerSession(authOptions);
}