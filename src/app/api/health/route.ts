import { connection } from "next/server";
import { pool } from "@/lib/auth";

// Reports whether the app can reach its database. Reveals nothing else.
export async function GET() {
  await connection();
  try {
    await pool.query("select 1");
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
