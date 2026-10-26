"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { pool } from "./auth";
import { emailConfigured, sendInBackground } from "./email";
import { teamInviteEmail } from "./email-templates";
import { requireUser } from "./session";
import {
  findInvite,
  hashInviteToken,
  inviteDays,
  invitePath,
  isInviteToken,
  isTeamRole,
  newInviteToken,
  teamSizeLimit,
  workspaceCookie,
  workspaceFor,
} from "./team";
import { getStudio } from "./studio";
import { isUuid } from "./deliveries";

export type TeamResult = { ok: true } | { ok: false; error: string };
export type InviteResult = { ok: true; link: string; emailed: boolean; email: string } | { ok: false; error: string };

const fail = (error: string) => ({ ok: false as const, error });
const done: TeamResult = { ok: true };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// A year: the choice should outlive a browser restart, and a stale one simply falls back to the person's own work.
const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 };

const baseUrl = () => process.env.BETTER_AUTH_URL || "http://localhost:3000";

// Every action below manages the signed-in person's own team, whichever workspace they are looking at.

export async function inviteTeammate(_previous: InviteResult | null, formData: FormData): Promise<InviteResult> {
  const user = await requireUser();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = formData.get("role");
  if (!emailPattern.test(email) || email.length > 254) return fail("Type the email address they sign in to Google with.");
  if (!isTeamRole(role)) return fail("Choose what they can do.");
  if (email === user.email.toLowerCase()) return fail("That is you. Invite someone else.");

  const { rows } = await pool.query<{ members: string; invites: string; already: boolean }>(
    `select (select count(*) from "teamMember" where "ownerId" = $1) as "members",
            (select count(*) from "teamInvite" where "ownerId" = $1 and "expiresAt" > now() and lower("email") <> $2) as "invites",
            exists (select 1 from "teamMember" m join "user" u on u."id" = m."userId" where m."ownerId" = $1 and lower(u."email") = $2) as "already"`,
    [user.id, email],
  );
  if (rows[0].already) return fail("They are already on your team.");
  if (Number(rows[0].members) + Number(rows[0].invites) >= teamSizeLimit) {
    return fail(`A team can have up to ${teamSizeLimit} people for now, invites included.`);
  }

  // Inviting the same address again replaces the old invite, so only the newest link works.
  const { token, hash } = newInviteToken();
  await pool.query(
    `insert into "teamInvite" ("ownerId", "email", "role", "tokenHash", "expiresAt")
     values ($1, $2, $3, $4, now() + make_interval(days => $5))
     on conflict ("ownerId", lower("email")) do update
       set "role" = excluded."role", "tokenHash" = excluded."tokenHash", "createdAt" = now(), "expiresAt" = excluded."expiresAt"`,
    [user.id, email, role, hash, inviteDays],
  );

  const link = new URL(invitePath(token), baseUrl()).toString();
  let emailed = false;
  if (emailConfigured()) {
    const studio = await getStudio(user.id);
    sendInBackground(teamInviteEmail({ to: email, ownerName: user.name, teamName: studio?.name?.trim() || user.name, role, url: link }));
    emailed = true;
  }
  revalidatePath("/team");
  return { ok: true, link, emailed, email };
}

export async function cancelInvite(inviteId: string): Promise<TeamResult> {
  const user = await requireUser();
  if (!isUuid(inviteId)) return fail("That invite was not found.");
  await pool.query(`delete from "teamInvite" where "id" = $1 and "ownerId" = $2`, [inviteId, user.id]);
  revalidatePath("/team");
  return done;
}

export async function changeRole(memberId: string, role: string): Promise<TeamResult> {
  const user = await requireUser();
  if (!isTeamRole(role)) return fail("Choose what they can do.");
  const result = await pool.query(`update "teamMember" set "role" = $1 where "ownerId" = $2 and "userId" = $3`, [role, user.id, memberId]);
  if (!result.rowCount) return fail("They are not on your team any more.");
  revalidatePath("/team");
  return done;
}

export async function removeMember(memberId: string): Promise<TeamResult> {
  const user = await requireUser();
  await pool.query(`delete from "teamMember" where "ownerId" = $1 and "userId" = $2`, [user.id, memberId]);
  revalidatePath("/team");
  return done;
}

export async function leaveTeam(ownerId: string): Promise<TeamResult> {
  const user = await requireUser();
  await pool.query(`delete from "teamMember" where "ownerId" = $1 and "userId" = $2`, [ownerId, user.id]);
  const store = await cookies();
  if (store.get(workspaceCookie)?.value === ownerId) store.delete(workspaceCookie);
  revalidatePath("/", "layout");
  return done;
}

// Switches which workspace (an empty id means your own) the sidebar, dashboard and every page after it show. Only a team the person is on counts.
export async function switchWorkspace(ownerId: string): Promise<TeamResult> {
  const user = await requireUser();
  const workspace = await workspaceFor(user, ownerId);
  const store = await cookies();
  if (workspace.ownerId === user.id) store.delete(workspaceCookie);
  else store.set(workspaceCookie, workspace.ownerId, cookieOptions);
  revalidatePath("/", "layout");
  return !ownerId || workspace.ownerId === ownerId ? done : fail("You are not on that team any more.");
}

// The invite must be for the address the person signed in with, so a forwarded link cannot be used by someone else.
export async function acceptInvite(token: string): Promise<TeamResult> {
  const user = await requireUser();
  if (!isInviteToken(token)) return fail("This invite link is not valid.");
  const invite = await findInvite(token);
  if (!invite || invite.expired) return fail("This invite has expired. Ask for a new one.");
  if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
    return fail(`This invite is for ${invite.email}. You are signed in as ${user.email}.`);
  }
  if (invite.ownerId === user.id) return fail("This is your own team.");
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(
      `insert into "teamMember" ("ownerId", "userId", "role") values ($1, $2, $3)
       on conflict ("ownerId", "userId") do update set "role" = excluded."role"`,
      [invite.ownerId, user.id, invite.role],
    );
    await client.query(`delete from "teamInvite" where "tokenHash" = $1`, [hashInviteToken(token)]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
  (await cookies()).set(workspaceCookie, invite.ownerId, cookieOptions);
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
