// Type augmentation for NextAuth
// UserRole is defined as: "student" | "instructor" | "admin" | "unknown"

declare module "next-auth" {
  interface Session {
    discordId?: string;
    role?: "student" | "instructor" | "admin" | "unknown";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    discordId?: string;
    role?: "student" | "instructor" | "admin" | "unknown";
  }
}

