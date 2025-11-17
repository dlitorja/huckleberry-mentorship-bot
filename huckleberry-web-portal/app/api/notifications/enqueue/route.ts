import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import { z } from "zod";
import { getToken } from "next-auth/jwt";

const EnqueueSchema = z.object({
  scheduled_session_id: z.string().uuid(),
  mentorship_id: z.string().uuid(),
  mentee_discord_id: z.string(),
  instructor_discord_id: z.string(),
  channel_id: z.string().optional(),
  fire_at_utc: z.string()
});

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = EnqueueSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const job = parsed.data;
  const score = Date.parse(job.fire_at_utc);
  if (Number.isNaN(score)) return NextResponse.json({ error: "Invalid fire_at_utc" }, { status: 400 });
  const redis = getRedis();
  await redis.zadd("reminders:sessions", { score, member: JSON.stringify(job) });
  return NextResponse.json({ ok: true });
}

