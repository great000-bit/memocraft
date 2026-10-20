import { createHash, randomUUID } from "node:crypto";
import { pool } from "./auth";

export const contactLimits = { name: 100, email: 254, message: 5000, messageMin: 10 };

// Counted in Better Auth's rateLimit table under keys of our own, so serverless processes share the count without a
// new table. Each key holds a fixed window: the count resets once the window has passed. Returns false when over.
async function underLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  const now = Date.now();
  const { rows } = await pool.query<{ count: number }>(
    `insert into "rateLimit" ("id", "key", "count", "lastRequest") values ($1, $2, 1, $3)
     on conflict ("key") do update set
       "count" = case when "rateLimit"."lastRequest" < $4 then 1 else "rateLimit"."count" + 1 end,
       "lastRequest" = case when "rateLimit"."lastRequest" < $4 then $3 else "rateLimit"."lastRequest" end
     returning "count"`,
    [randomUUID(), key, now, now - windowMs],
  );
  return rows[0].count <= max;
}

// Three messages an hour from one address, and fifty an hour in all, which keeps a flood from emptying the email
// quota. The address is hashed with the app secret, so the table never holds a visitor's IP.
export async function contactAllowed(ip: string): Promise<boolean> {
  const hour = 60 * 60 * 1000;
  const hashed = createHash("sha256").update(`${process.env.BETTER_AUTH_SECRET ?? ""}:${ip}`).digest("hex").slice(0, 32);
  if (!(await underLimit(`contact:ip:${hashed}`, 3, hour))) return false;
  return underLimit("contact:all", 50, hour);
}

export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim() || "unknown";
}

export const looksLikeEmail = (value: string) => /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/.test(value);
