import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { pool } from "./auth";
import { requireUser } from "./session";

// Teams. A team is the owner's own account: a teammate who switches into it works on the owner's deliveries,
// library, requests and storage as if they were the owner. Everything the workspace reads or changes therefore
// goes through a "workspace", which names whose work it is (ownerId) and what the signed-in person may do there.
// Profile, settings, notifications, Drive backup and the studio brand stay personal and keep using the user's own id.

export type TeamRole = "editor" | "viewer";
export type WorkspaceRole = "owner" | TeamRole;

export const teamRoles: TeamRole[] = ["editor", "viewer"];
export const isTeamRole = (value: unknown): value is TeamRole => value === "editor" || value === "viewer";

export const roleLabel: Record<WorkspaceRole, string> = { owner: "Owner", editor: "Editor", viewer: "Viewer" };

// How many people one owner can bring in, invites still waiting included. A placeholder until pricing is decided.
export const teamSizeLimit = 10;
export const inviteDays = 14;

export type Workspace = {
  // The signed-in person.
  userId: string;
  // Whose work this is. Every query about deliveries, files and requests uses this id.
  ownerId: string;
  role: WorkspaceRole;
  canEdit: boolean;
  // The team's name as the person sees it: the owner's studio name, or else the owner's own name.
  name: string;
};

export const viewOnlyError = "You can view this team's work but not change it. Ask the owner to make you an editor.";

// The workspace someone has picked lives in this cookie, as the owner's user id. It proves nothing by itself: the
// membership is checked against the database on every request, and anything stale falls back to their own work.
export const workspaceCookie = "mc-workspace";

type User = { id: string; name: string };

const teamName = `coalesce(nullif(trim(s."name"), ''), o."name")`;

export async function workspaceFor(user: User, chosen: string | undefined): Promise<Workspace> {
  const own: Workspace = { userId: user.id, ownerId: user.id, role: "owner", canEdit: true, name: user.name };
  if (!chosen || chosen === user.id) return own;
  const { rows } = await pool.query<{ role: TeamRole; name: string }>(
    `select m."role", ${teamName} as "name"
       from "teamMember" m
       join "user" o on o."id" = m."ownerId"
       left join "studio" s on s."userId" = m."ownerId"
      where m."ownerId" = $1 and m."userId" = $2`,
    [chosen, user.id],
  );
  const row = rows[0];
  if (!row) return own;
  return { userId: user.id, ownerId: chosen, role: row.role, canEdit: row.role === "editor", name: row.name };
}

// The workspace for this request. Redirects to log in when nobody is signed in, like requireUser.
export const getWorkspace = cache(async (): Promise<Workspace> => {
  const user = await requireUser();
  return workspaceFor(user, (await cookies()).get(workspaceCookie)?.value);
});

// The same for API routes, which answer 404 instead of redirecting.
export async function workspaceForSession(session: { user: User } | null): Promise<Workspace | null> {
  if (!session) return null;
  return workspaceFor(session.user, (await cookies()).get(workspaceCookie)?.value);
}

// Every workspace the person can switch to: their own first, then the teams they are in.
export type WorkspaceChoice = { ownerId: string; name: string; role: WorkspaceRole };

export async function listWorkspaces(user: User): Promise<WorkspaceChoice[]> {
  const { rows } = await pool.query<WorkspaceChoice>(
    `select m."ownerId", ${teamName} as "name", m."role"
       from "teamMember" m
       join "user" o on o."id" = m."ownerId"
       left join "studio" s on s."userId" = m."ownerId"
      where m."userId" = $1
      order by 2, 1`,
    [user.id],
  );
  return [{ ownerId: user.id, name: "My workspace", role: "owner" }, ...rows];
}

// True when this person is the owner or anyone on the owner's team. Their own visits to a client link are not proof.
export async function isOnTeam(ownerId: string, userId: string): Promise<boolean> {
  if (ownerId === userId) return true;
  const { rowCount } = await pool.query(`select 1 from "teamMember" where "ownerId" = $1 and "userId" = $2`, [ownerId, userId]);
  return Boolean(rowCount);
}

export type TeamMember = { userId: string; name: string; email: string; image: string | null; role: TeamRole; joinedAt: Date };
export type TeamInvite = { id: string; email: string; role: TeamRole; createdAt: Date; expiresAt: Date };

export async function listTeam(ownerId: string): Promise<{ members: TeamMember[]; invites: TeamInvite[] }> {
  const [members, invites] = await Promise.all([
    pool.query<TeamMember>(
      `select u."id" as "userId", u."name", u."email", nullif(u."image", '') as "image", m."role", m."createdAt" as "joinedAt"
         from "teamMember" m join "user" u on u."id" = m."userId"
        where m."ownerId" = $1
        order by m."createdAt", u."id"`,
      [ownerId],
    ),
    pool.query<TeamInvite>(
      `select "id", "email", "role", "createdAt", "expiresAt" from "teamInvite"
        where "ownerId" = $1 and "expiresAt" > now()
        order by "createdAt" desc, "id"`,
      [ownerId],
    ),
  ]);
  return { members: members.rows, invites: invites.rows };
}

// Invite links carry 32 random bytes; the database keeps only the hash.
export function newInviteToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashInviteToken(token) };
}

export const hashInviteToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const invitePath = (token: string) => `/join/${token}`;

const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
export const isInviteToken = (value: unknown): value is string => typeof value === "string" && tokenPattern.test(value);

export type InviteDetails = { id: string; ownerId: string; email: string; role: TeamRole; teamName: string; ownerName: string; expired: boolean };

export async function findInvite(token: string): Promise<InviteDetails | null> {
  if (!isInviteToken(token)) return null;
  const { rows } = await pool.query<InviteDetails>(
    `select i."id", i."ownerId", i."email", i."role", ${teamName} as "teamName", o."name" as "ownerName", i."expiresAt" <= now() as "expired"
       from "teamInvite" i
       join "user" o on o."id" = i."ownerId"
       left join "studio" s on s."userId" = i."ownerId"
      where i."tokenHash" = $1`,
    [hashInviteToken(token)],
  );
  return rows[0] ?? null;
}

// Whose work the signed-in person is looking at. Reading is open to every role.
export async function workspaceOwnerId(): Promise<string> {
  return (await getWorkspace()).ownerId;
}

// Whose work the signed-in person may change, or null when they are a viewer there. Actions answer null with
// viewOnlyError, so a viewer gets a plain message instead of a broken page.
export async function editableOwnerId(): Promise<string | null> {
  const workspace = await getWorkspace();
  return workspace.canEdit ? workspace.ownerId : null;
}
