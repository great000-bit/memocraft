import { notFound } from "next/navigation";
import { pool } from "./auth";
import { isAdmin } from "./admin-check";
import { getSession } from "./session";

export { isAdmin };

// The proxy already turns everyone else away with a 404; this is the second lock, for anything that reaches a page.
export async function requireAdmin() {
  const session = await getSession();
  if (!session || !isAdmin(session.user)) notFound();
  return session.user;
}

export async function recordAdminView(admin: { id: string; email: string }, targetUserId: string): Promise<void> {
  // A page can be rendered more than once for one visit, and a reload a moment later is the same look, so one row
  // per admin and account per minute.
  await pool.query(
    `insert into "adminAudit" ("adminId", "adminEmail", "action", "targetUserId")
     select $1, $2, 'view_user', $3
      where not exists (select 1 from "adminAudit"
                         where "adminId" = $1 and "targetUserId" = $3 and "action" = 'view_user' and "at" > now() - interval '1 minute')`,
    [admin.id, admin.email, targetUserId],
  );
}
