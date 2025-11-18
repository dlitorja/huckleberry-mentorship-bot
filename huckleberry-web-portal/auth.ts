import NextAuth, { type NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth/next";
import DiscordProvider from "next-auth/providers/discord";
import { getUserRoleByDiscordId } from "@/lib/auth";
import { JWT } from "next-auth/jwt";
import { Account, Profile, Session } from "next-auth";

if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
  throw new Error("Missing Discord client ID or secret");
}

export const authOptions: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, account, profile }: { token: JWT; account: Account | null; profile?: Profile }) {
      if (account && profile && "id" in profile) {
        const discordId = String((profile as any).id);
        token.discordId = discordId;
        const role = await getUserRoleByDiscordId(discordId);
        token.role = role;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user && token.discordId) {
        (session.user as any).id = token.id;
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

// Export auth function for server-side usage (wrapper around getServerSession)
export async function auth() {
  return await getServerSession(authOptions);
}
