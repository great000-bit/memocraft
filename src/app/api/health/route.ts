import { connection } from "next/server";
import { pool } from "@/lib/auth";
import { storageStatus } from "@/lib/storage";

// Reports whether the app can reach its database and its file storage. Reveals nothing else.
export async function GET() {
  await connection();
  const storage = await storageStatus();
  try {
    await pool.query("select 1");
    return Response.json({ ok: true, storage });
  } catch {
    return Response.json({ ok: false, storage }, { status: 503 });
  }
}
