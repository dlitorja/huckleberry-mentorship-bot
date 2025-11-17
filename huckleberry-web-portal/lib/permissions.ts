import { UserRole } from "./auth";

export function canViewMentorship(role: UserRole, ownership: "self" | "instructorOf" | "admin"): boolean {
  if (role === "admin") return true;
  if (role === "instructor" && (ownership === "instructorOf" || ownership === "self")) return true;
  if (role === "student" && ownership === "self") return true;
  return false;
}

