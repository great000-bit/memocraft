import { auth, pool } from "./auth";
import { DRIVE_SCOPE } from "./drive-scope";
import { getObjectRange, storageConfigured } from "./storage";

// Optional "Back up to my Google Drive". Memocraft asks only for drive.file, which lets it see the files and
// folders it creates itself and nothing else in the person's Drive. Client pages never depend on this copy.

// The two bases can be pointed at a test server; production always uses Google.
const API = `${process.env.DRIVE_API_BASE || "https://www.googleapis.com"}/drive/v3`;
const UPLOAD = `${process.env.DRIVE_API_BASE || "https://www.googleapis.com"}/upload/drive/v3/files?uploadType=resumable&fields=id`;
// Drive wants resumable chunks in multiples of 256 KiB.
const CHUNK = 8 * 1024 * 1024;
const LOCK_SECONDS = 90;
const MAX_ATTEMPTS = 5;

export const REAUTH_MESSAGE = "Google needs you to connect Drive again.";
export const FULL_MESSAGE = "Your Google Drive is full. Free some space and press Back up now.";

// Thrown for problems that stop the whole run (as opposed to one file): the message is shown in Settings.
class StopRun extends Error {}

export type DriveStatus = {
  // Google has handed over the drive.file permission.
  connected: boolean;
  enabled: boolean;
  lastError: string | null;
  pending: number;
  done: number;
  failed: number;
};

type GoogleAccount = { id: string; scope: string | null };

async function googleAccount(userId: string): Promise<GoogleAccount | null> {
  const { rows } = await pool.query<GoogleAccount>(
    `select "id", "scope" from "account" where "userId" = $1 and "providerId" = 'google' limit 1`,
    [userId],
  );
  return rows[0] ?? null;
}

export const hasDriveScope = (scope: string | null | undefined) => Boolean(scope && scope.split(/[\s,]+/).includes(DRIVE_SCOPE));

export async function driveStatus(userId: string): Promise<DriveStatus> {
  const [account, state, counts] = await Promise.all([
    googleAccount(userId),
    pool.query<{ enabled: boolean; lastError: string | null }>(`select "enabled", "lastError" from "driveBackup" where "userId" = $1`, [userId]),
    pool.query<{ status: string; n: string }>(`select "status", count(*) as n from "driveBackupFile" where "userId" = $1 group by 1`, [userId]),
  ]);
  const count = (status: string) => Number(counts.rows.find((r) => r.status === status)?.n ?? 0);
  return {
    connected: hasDriveScope(account?.scope),
    enabled: state.rows[0]?.enabled ?? false,
    lastError: state.rows[0]?.lastError ?? null,
    pending: count("pending"),
    done: count("done"),
    failed: count("failed"),
  };
}

// Turns the backup on for someone who has just granted the permission, and queues the files they already have.
export async function enableBackup(userId: string) {
  await pool.query(
    `insert into "driveBackup" ("userId", "enabled", "lastError") values ($1, true, null)
     on conflict ("userId") do update set "enabled" = true, "lastError" = null, "updatedAt" = now()`,
    [userId],
  );
  await pool.query(
    `insert into "driveBackupFile" ("fileId", "userId", "storageKey")
     select f."id", d."ownerId", f."storageKey"
       from "deliveryFile" f
       join "deliverySection" s on s."id" = f."sectionId"
       join "delivery" d on d."id" = s."deliveryId"
      where d."ownerId" = $1 and f."storageKey" is not null
     on conflict ("fileId") do update set
       "status" = case when "driveBackupFile"."storageKey" = excluded."storageKey" then "driveBackupFile"."status" else 'pending' end,
       "sessionUri" = case when "driveBackupFile"."storageKey" = excluded."storageKey" then "driveBackupFile"."sessionUri" else null end,
       "sentBytes" = case when "driveBackupFile"."storageKey" = excluded."storageKey" then "driveBackupFile"."sentBytes" else 0 end,
       "storageKey" = excluded."storageKey"`,
    [userId],
  );
}

export async function disableBackup(userId: string) {
  await pool.query(`update "driveBackup" set "enabled" = false, "updatedAt" = now() where "userId" = $1`, [userId]);
}

// Queues one finished upload, but only for people who have the backup on.
export async function queueFile(userId: string, fileId: string) {
  await pool.query(
    `insert into "driveBackupFile" ("fileId", "userId", "storageKey")
     select f."id", $1, f."storageKey"
       from "deliveryFile" f
      where f."id" = $2 and f."storageKey" is not null
        and exists (select 1 from "driveBackup" b where b."userId" = $1 and b."enabled")
     on conflict ("fileId") do update set
       "status" = 'pending', "sessionUri" = null, "sentBytes" = 0, "attempts" = 0, "error" = null,
       "storageKey" = excluded."storageKey", "updatedAt" = now()
      where "driveBackupFile"."storageKey" <> excluded."storageKey"`,
    [userId, fileId],
  );
}

async function setError(userId: string, message: string | null) {
  await pool.query(`update "driveBackup" set "lastError" = $2, "updatedAt" = now() where "userId" = $1`, [userId, message]);
}

async function accessToken(userId: string): Promise<string> {
  const account = await googleAccount(userId);
  if (!account || !hasDriveScope(account.scope)) throw new StopRun(REAUTH_MESSAGE);
  try {
    const result = await auth.api.getAccessToken({ body: { accountId: account.id, userId } });
    if (!result?.accessToken) throw new Error("no token");
    return result.accessToken;
  } catch {
    // The refresh token was revoked or has expired: the person has to grant Drive again.
    throw new StopRun(REAUTH_MESSAGE);
  }
}

async function drive(token: string, url: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...init.headers } });
  if (response.status === 401) throw new StopRun(REAUTH_MESSAGE);
  if (response.status === 403 || response.status === 429) {
    const body = await response.clone().text();
    if (body.includes("storageQuotaExceeded")) throw new StopRun(FULL_MESSAGE);
    if (body.includes("insufficientPermissions") || body.includes("ACCESS_TOKEN_SCOPE_INSUFFICIENT")) throw new StopRun(REAUTH_MESSAGE);
    // Anything else is Google asking us to slow down: stop now and let the next run continue.
    throw new StopRun("Google asked Memocraft to slow down. The backup continues shortly.");
  }
  return response;
}

async function createFolder(token: string, name: string, parent?: string): Promise<string> {
  const response = await drive(token, `${API}/files?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", ...(parent ? { parents: [parent] } : {}) }),
  });
  if (!response.ok) throw new Error(`Folder create failed (${response.status})`);
  return ((await response.json()) as { id: string }).id;
}

async function rootFolder(token: string, userId: string): Promise<string> {
  const { rows } = await pool.query<{ folderId: string | null }>(`select "folderId" from "driveBackup" where "userId" = $1`, [userId]);
  if (rows[0]?.folderId) return rows[0].folderId;
  const id = await createFolder(token, "Memocraft");
  await pool.query(`update "driveBackup" set "folderId" = $2 where "userId" = $1`, [userId, id]);
  return id;
}

async function deliveryFolder(token: string, userId: string, deliveryId: string, title: string): Promise<string> {
  const { rows } = await pool.query<{ folderId: string }>(`select "folderId" from "driveBackupFolder" where "deliveryId" = $1`, [deliveryId]);
  if (rows[0]) return rows[0].folderId;
  const parent = await rootFolder(token, userId);
  const id = await createFolder(token, title.replace(/[\\/]/g, "-").slice(0, 100) || "Delivery", parent);
  await pool.query(
    `insert into "driveBackupFolder" ("deliveryId", "folderId") values ($1, $2)
     on conflict ("deliveryId") do update set "folderId" = excluded."folderId"`,
    [deliveryId, id],
  );
  return id;
}

// The person deleted the Memocraft folder in Drive: forget the folders so they are made again.
async function forgetFolders(userId: string) {
  await pool.query(`update "driveBackup" set "folderId" = null where "userId" = $1`, [userId]);
  await pool.query(
    `delete from "driveBackupFolder" where "deliveryId" in (select "id" from "delivery" where "ownerId" = $1)`,
    [userId],
  );
}

type Job = {
  fileId: string;
  storageKey: string;
  sessionUri: string | null;
  sentBytes: string;
  attempts: number;
  name: string;
  size: string;
  mime: string | null;
  deliveryId: string;
  title: string;
};

// Takes the oldest waiting job that nobody else is copying, and holds it for a while.
async function claim(userId: string): Promise<Job | null> {
  const { rows } = await pool.query<Job>(
    `with next as (
       select b."fileId" from "driveBackupFile" b
        where b."userId" = $1 and b."status" = 'pending' and (b."lockedUntil" is null or b."lockedUntil" < now())
        order by b."updatedAt" limit 1 for update skip locked
     ), taken as (
       update "driveBackupFile" b set "lockedUntil" = now() + make_interval(secs => $2)
         from next where b."fileId" = next."fileId" returning b.*
     )
     select t."fileId", t."storageKey", t."sessionUri", t."sentBytes", t."attempts",
            f."name", f."sizeBytes" as "size", f."mimeType" as "mime", d."id" as "deliveryId", d."title"
       from taken t
       join "deliveryFile" f on f."id" = t."fileId"
       join "deliverySection" s on s."id" = f."sectionId"
       join "delivery" d on d."id" = s."deliveryId"`,
    [userId, LOCK_SECONDS],
  );
  return rows[0] ?? null;
}

async function release(fileId: string) {
  await pool.query(`update "driveBackupFile" set "lockedUntil" = null where "fileId" = $1`, [fileId]);
}

async function startSession(token: string, job: Job, folderId: string): Promise<string | null> {
  const response = await drive(token, UPLOAD, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": job.mime || "application/octet-stream",
      "X-Upload-Content-Length": job.size,
    },
    body: JSON.stringify({ name: job.name, parents: [folderId] }),
  });
  if (response.status === 404) return null;
  const location = response.headers.get("location");
  if (!response.ok || !location) throw new Error(`Drive upload could not start (${response.status})`);
  return location;
}

// Copies one file, a piece at a time, until it is done or the time budget runs out. Returns true when finished.
async function copyFile(token: string, userId: string, job: Job, deadline: number): Promise<boolean> {
  const total = Number(job.size);
  let sent = Number(job.sentBytes);
  let session = job.sessionUri;

  if (!session) {
    let folder = await deliveryFolder(token, userId, job.deliveryId, job.title);
    session = await startSession(token, job, folder);
    if (!session) {
      // The folder is gone from Drive: make it again once.
      await forgetFolders(userId);
      folder = await deliveryFolder(token, userId, job.deliveryId, job.title);
      session = await startSession(token, job, folder);
      if (!session) throw new Error("Drive upload could not start");
    }
    sent = 0;
    await pool.query(`update "driveBackupFile" set "sessionUri" = $2, "sentBytes" = 0 where "fileId" = $1`, [job.fileId, session]);
  }

  while (sent < total) {
    if (Date.now() > deadline) return false;
    const end = Math.min(sent + CHUNK, total) - 1;
    const bytes = await getObjectRange(job.storageKey, sent, end);
    const response = await fetch(session, {
      method: "PUT",
      headers: { "Content-Length": String(bytes.length), "Content-Range": `bytes ${sent}-${end}/${total}` },
      body: Buffer.from(bytes),
    });
    if (response.status === 200 || response.status === 201) {
      const { id } = (await response.json()) as { id: string };
      await pool.query(
        `update "driveBackupFile" set "status" = 'done', "driveFileId" = $2, "sentBytes" = $3, "sessionUri" = null, "error" = null, "updatedAt" = now()
          where "fileId" = $1`,
        [job.fileId, id, total],
      );
      return true;
    }
    if (response.status === 308) {
      const range = /bytes=0-(\d+)/.exec(response.headers.get("range") ?? "");
      sent = range ? Number(range[1]) + 1 : sent;
      await pool.query(`update "driveBackupFile" set "sentBytes" = $2 where "fileId" = $1`, [job.fileId, sent]);
      continue;
    }
    if (response.status === 404 || response.status === 410) {
      // The upload session expired: start this file again from the beginning next time.
      await pool.query(`update "driveBackupFile" set "sessionUri" = null, "sentBytes" = 0 where "fileId" = $1`, [job.fileId]);
      return false;
    }
    if (response.status === 401) throw new StopRun(REAUTH_MESSAGE);
    if (response.status === 403) {
      const body = await response.text();
      if (body.includes("storageQuotaExceeded")) throw new StopRun(FULL_MESSAGE);
    }
    throw new Error(`Drive refused part of the file (${response.status})`);
  }
  return true;
}

// Copies waiting files into the person's Drive for up to `budgetMs`. Safe to call from several places at once.
export async function runDriveBackup(userId: string, budgetMs = 40_000): Promise<void> {
  if (!storageConfigured()) return;
  const state = await pool.query<{ enabled: boolean }>(`select "enabled" from "driveBackup" where "userId" = $1`, [userId]);
  if (!state.rows[0]?.enabled) return;

  const deadline = Date.now() + budgetMs;
  try {
    const token = await accessToken(userId);
    await setError(userId, null);
    while (Date.now() < deadline) {
      const job = await claim(userId);
      if (!job) break;
      try {
        await copyFile(token, userId, job, deadline);
      } catch (error) {
        if (error instanceof StopRun) throw error;
        const attempts = job.attempts + 1;
        console.error("Drive backup of one file failed", error);
        await pool.query(
          `update "driveBackupFile" set "attempts" = $2, "error" = $3, "status" = case when $2 >= $4 then 'failed' else "status" end, "updatedAt" = now()
            where "fileId" = $1`,
          [job.fileId, attempts, error instanceof Error ? error.message.slice(0, 200) : "Unknown error", MAX_ATTEMPTS],
        );
      } finally {
        await release(job.fileId);
      }
    }
  } catch (error) {
    if (error instanceof StopRun) {
      await setError(userId, error.message);
      return;
    }
    console.error("Drive backup stopped", error);
  }
}

// Pushes every failed or waiting file back into the queue, for the "Back up now" button.
export async function retryAll(userId: string) {
  await pool.query(
    `update "driveBackupFile" set "status" = 'pending', "attempts" = 0, "error" = null, "lockedUntil" = null, "updatedAt" = now()
      where "userId" = $1 and "status" in ('pending', 'failed')`,
    [userId],
  );
}

export async function usersWithWaitingFiles(): Promise<string[]> {
  const { rows } = await pool.query<{ userId: string }>(
    `select distinct b."userId" from "driveBackupFile" b join "driveBackup" k on k."userId" = b."userId" and k."enabled"
      where b."status" = 'pending'`,
  );
  return rows.map((r) => r.userId);
}
