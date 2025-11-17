import { UserRole } from "@/lib/auth";

declare module "next-auth" {
  interface Session {
    discordId?: string;
    role?: UserRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    discordId?: string;
    role?: UserRole;
  }
}

