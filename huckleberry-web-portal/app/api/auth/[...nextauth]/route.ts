import NextAuth from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { getUserRoleByDiscordId } from "@/lib/auth";

const handler = NextAuth({
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID || "",
      clientSecret: process.env.DISCORD_CLIENT_SECRET || ""
    })
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, account, profile }) {
      // On first sign-in, add discord id and role
      if (account && profile && "id" in profile) {
        const discordId = String((profile as any).id);
        token.discordId = discordId;
        const role = await getUserRoleByDiscordId(discordId);
        token.role = role;
      }
      return token;
    },
    async session({ session, token }) {
      session.discordId = token.discordId;
      session.role = token.role;
      return session;
    }
  }
});

export { handler as GET, handler as POST };

