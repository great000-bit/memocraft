import { pool } from "./auth";
import { storageLimits } from "./storage-limits";

// Everything the admin console reads. Counts and sums are worked out in the database, one round trip per block,
// and lists are paged, so the console stays light however many people sign up. Nothing here reads a file's
// contents: only names, sizes and counts.

// Storage per person: files that are in storage plus their earlier versions, the same sum the upload check uses.
const storageByOwner = `
  files as (
    select d."ownerId",
           coalesce(sum(f."sizeBytes") filter (where f."storageKey" is not null), 0) as "bytes",
           count(*) filter (where f."storageKey" is not null) as "files",
           count(*) filter (where f."pending" is not null) as "uploading"
      from "deliveryFile" f
      join "deliverySection" s on s."id" = f."sectionId"
      join "delivery" d on d."id" = s."deliveryId"
     group by d."ownerId"
  ),
  versions as (
    select d."ownerId", coalesce(sum(v."sizeBytes"), 0) as "bytes", count(*) as "versions"
      from "deliveryFileVersion" v
      join "deliveryFile" f on f."id" = v."fileId"
      join "deliverySection" s on s."id" = f."sectionId"
      join "delivery" d on d."id" = s."deliveryId"
     group by d."ownerId"
  )`;

export type Overview = {
  users: number;
  newUsers7d: number;
  active7d: number;
  deliveries: number;
  published: number;
  storageBytes: number;
  files: number;
  opens30d: number;
  downloads30d: number;
  openRequests: number;
  pushDevices: number;
};

export async function getOverview(): Promise<Overview> {
  const { rows } = await pool.query(
    `select (select count(*) from "user") as "users",
            (select count(*) from "user" where "createdAt" >= now() - interval '7 days') as "newUsers7d",
            (select count(distinct "userId") from "session" where "updatedAt" >= now() - interval '7 days') as "active7d",
            (select count(*) from "delivery") as "deliveries",
            (select count(*) from "delivery" where "status" = 'published') as "published",
            (select coalesce(sum("sizeBytes"), 0) from "deliveryFile" where "storageKey" is not null)
              + (select coalesce(sum("sizeBytes"), 0) from "deliveryFileVersion") as "storageBytes",
            (select count(*) from "deliveryFile" where "storageKey" is not null) as "files",
            (select count(*) from "deliveryEvent" where "kind" = 'open' and "at" >= now() - interval '30 days') as "opens30d",
            (select count(*) from "deliveryEvent" where "kind" = 'download' and "at" >= now() - interval '30 days') as "downloads30d",
            (select count(*) from "fileRequest" where "status" = 'open') as "openRequests",
            (select count(*) from "pushSubscription") as "pushDevices"`,
  );
  const row = rows[0];
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)])) as Overview;
}

export type DayCount = { day: string; signups: number; opens: number; downloads: number };

// The last 30 days, one row per day (UTC), including days when nothing happened.
export async function getDailyCounts(): Promise<DayCount[]> {
  const { rows } = await pool.query<{ day: string; signups: string; opens: string; downloads: string }>(
    `with days as (
       select generate_series(date_trunc('day', now() at time zone 'UTC') - interval '29 days',
                              date_trunc('day', now() at time zone 'UTC'), interval '1 day') as "day"
     ),
     signups as (
       select date_trunc('day', "createdAt" at time zone 'UTC') as "day", count(*) as "n"
         from "user" where "createdAt" >= now() - interval '31 days' group by 1
     ),
     events as (
       select date_trunc('day', "at" at time zone 'UTC') as "day",
              count(*) filter (where "kind" = 'open') as "opens",
              count(*) filter (where "kind" = 'download') as "downloads"
         from "deliveryEvent" where "at" >= now() - interval '31 days' group by 1
     )
     select to_char(d."day", 'YYYY-MM-DD') as "day",
            coalesce(s."n", 0) as "signups", coalesce(e."opens", 0) as "opens", coalesce(e."downloads", 0) as "downloads"
       from days d
       left join signups s on s."day" = d."day"
       left join events e on e."day" = d."day"
      order by d."day"`,
  );
  return rows.map((r) => ({ day: r.day, signups: Number(r.signups), opens: Number(r.opens), downloads: Number(r.downloads) }));
}

export type AuditRow = { id: string; adminEmail: string; action: string; targetUserId: string | null; targetName: string | null; at: Date };

export async function listAudit(limit = 8): Promise<AuditRow[]> {
  const { rows } = await pool.query<AuditRow>(
    `select a."id", a."adminEmail", a."action", a."targetUserId", u."name" as "targetName", a."at"
       from "adminAudit" a left join "user" u on u."id" = a."targetUserId"
      order by a."at" desc limit $1`,
    [limit],
  );
  return rows;
}

export type UserSort = "newest" | "active" | "storage" | "deliveries";
export const userSorts: Record<UserSort, string> = {
  newest: "Newest",
  active: "Last active",
  storage: "Storage",
  deliveries: "Deliveries",
};

export type UserRow = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  emailVerified: boolean;
  createdAt: Date;
  lastActive: Date | null;
  providers: string[];
  deliveries: number;
  published: number;
  files: number;
  storageBytes: number;
};

const orderBy: Record<UserSort, string> = {
  newest: `u."createdAt" desc`,
  active: `"lastActive" desc nulls last, u."createdAt" desc`,
  storage: `"storageBytes" desc, u."createdAt" desc`,
  deliveries: `"deliveries" desc, u."createdAt" desc`,
};

export const usersPerPage = 25;

// A search matches name or email anywhere; % and _ typed by the admin are taken literally.
export async function listUsers(options: { q: string; sort: UserSort; page: number }): Promise<{ users: UserRow[]; total: number }> {
  const pattern = options.q ? `%${options.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
  const { rows } = await pool.query(
    `with ${storageByOwner},
     dels as (
       select "ownerId", count(*) as "total", count(*) filter (where "status" = 'published') as "published",
              max("updatedAt") as "last"
         from "delivery" group by "ownerId"
     ),
     sess as (select "userId", max("updatedAt") as "last" from "session" group by "userId"),
     prov as (select "userId", array_agg(distinct "providerId" order by "providerId") as "providers" from "account" group by "userId")
     select u."id", u."name", u."email", u."image", u."emailVerified", u."createdAt",
            nullif(greatest(coalesce(sess."last", '-infinity'), coalesce(dels."last", '-infinity')), '-infinity') as "lastActive",
            coalesce(prov."providers", '{}') as "providers",
            coalesce(dels."total", 0) as "deliveries", coalesce(dels."published", 0) as "published",
            coalesce(files."files", 0) as "files",
            coalesce(files."bytes", 0) + coalesce(versions."bytes", 0) as "storageBytes",
            count(*) over () as "totalRows"
       from "user" u
       left join dels on dels."ownerId" = u."id"
       left join sess on sess."userId" = u."id"
       left join prov on prov."userId" = u."id"
       left join files on files."ownerId" = u."id"
       left join versions on versions."ownerId" = u."id"
      where $1::text is null or u."name" ilike $1 or u."email" ilike $1
      order by ${orderBy[options.sort]}
      limit $2 offset $3`,
    [pattern, usersPerPage, (options.page - 1) * usersPerPage],
  );
  return {
    total: rows.length > 0 ? Number(rows[0].totalRows) : 0,
    users: rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      image: r.image,
      emailVerified: r.emailVerified,
      createdAt: r.createdAt,
      lastActive: r.lastActive,
      providers: r.providers,
      deliveries: Number(r.deliveries),
      published: Number(r.published),
      files: Number(r.files),
      storageBytes: Number(r.storageBytes),
    })),
  };
}

export type UserDetail = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  providers: string[];
  studioName: string | null;
  hasStudioLogo: boolean;
  lastActive: Date | null;
  activeSessions: number;
  sessionDevices: string[];
  pushDevices: string[];
  storage: { fileBytes: number; versionBytes: number; files: number; versions: number; thumbs: number; uploading: number; limitBytes: number };
};

// A session's browser is reduced to a short label, the same way client devices are, and the IP address is never read.
function deviceLabel(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";
  const ua = userAgent;
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "Other";
  const browser = /Edg\//.test(ua) ? "Edge" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /FxiOS|Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${browser} on ${os}`;
}

export async function getUserDetail(id: string): Promise<UserDetail | null> {
  const [user, sessions, storage] = await Promise.all([
    pool.query(
      `select u."id", u."name", u."email", u."image", u."emailVerified", u."createdAt", u."updatedAt",
              st."name" as "studioName", st."logoVersion" is not null as "hasStudioLogo",
              coalesce((select array_agg(distinct a."providerId" order by a."providerId") from "account" a where a."userId" = u."id"), '{}') as "providers",
              coalesce((select array_agg(p."device" order by p."createdAt") from "pushSubscription" p where p."userId" = u."id"), '{}') as "pushDevices",
              (select max("updatedAt") from "delivery" d where d."ownerId" = u."id") as "lastDelivery"
         from "user" u left join "studio" st on st."userId" = u."id"
        where u."id" = $1`,
      [id],
    ),
    pool.query<{ userAgent: string | null; updatedAt: Date; live: boolean }>(
      `select "userAgent", "updatedAt", "expiresAt" > now() as "live" from "session" where "userId" = $1 order by "updatedAt" desc limit 20`,
      [id],
    ),
    pool.query(
      `select coalesce(sum(f."sizeBytes") filter (where f."storageKey" is not null), 0) as "fileBytes",
              count(*) filter (where f."storageKey" is not null) as "files",
              count(*) filter (where f."thumbKey" is not null) as "thumbs",
              count(*) filter (where f."pending" is not null) as "uploading",
              (select coalesce(sum(v."sizeBytes"), 0) from "deliveryFileVersion" v
                 join "deliveryFile" vf on vf."id" = v."fileId"
                 join "deliverySection" vs on vs."id" = vf."sectionId"
                 join "delivery" vd on vd."id" = vs."deliveryId" where vd."ownerId" = $1) as "versionBytes",
              (select count(*) from "deliveryFileVersion" v
                 join "deliveryFile" vf on vf."id" = v."fileId"
                 join "deliverySection" vs on vs."id" = vf."sectionId"
                 join "delivery" vd on vd."id" = vs."deliveryId" where vd."ownerId" = $1) as "versions"
         from "deliveryFile" f
         join "deliverySection" s on s."id" = f."sectionId"
         join "delivery" d on d."id" = s."deliveryId"
        where d."ownerId" = $1`,
      [id],
    ),
  ]);
  const u = user.rows[0];
  if (!u) return null;
  const s = storage.rows[0];
  const lastSession = sessions.rows[0]?.updatedAt ?? null;
  const candidates = [lastSession, u.lastDelivery].filter(Boolean) as Date[];
  const live = sessions.rows.filter((row) => row.live);
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    image: u.image,
    emailVerified: u.emailVerified,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    providers: u.providers,
    studioName: u.studioName,
    hasStudioLogo: Boolean(u.hasStudioLogo),
    lastActive: candidates.length ? new Date(Math.max(...candidates.map((d) => d.getTime()))) : null,
    activeSessions: live.length,
    sessionDevices: [...new Set(live.map((row) => deviceLabel(row.userAgent)))],
    pushDevices: u.pushDevices,
    storage: {
      fileBytes: Number(s.fileBytes),
      versionBytes: Number(s.versionBytes),
      files: Number(s.files),
      versions: Number(s.versions),
      thumbs: Number(s.thumbs),
      uploading: Number(s.uploading),
      limitBytes: storageLimits.accountBytes,
    },
  };
}

export type AdminDelivery = {
  id: string;
  title: string;
  clientName: string | null;
  status: "draft" | "published";
  expiresAt: Date | null;
  hasPassword: boolean;
  createdAt: Date;
  publishedAt: Date | null;
  files: number;
  bytes: number;
  opens: number;
  downloads: number;
  openRequests: number;
};

export async function listUserDeliveries(ownerId: string, limit = 50): Promise<AdminDelivery[]> {
  const { rows } = await pool.query(
    `select d."id", d."title", d."clientName", d."status", d."expiresAt", d."passwordHash" is not null as "hasPassword",
            d."createdAt", d."publishedAt", f."files", f."bytes", e."opens", e."downloads",
            (select count(*) from "fileRequest" r where r."deliveryId" = d."id" and r."status" = 'open') as "openRequests"
       from "delivery" d
       cross join lateral (
         select count(*) filter (where df."storageKey" is not null) as "files",
                coalesce(sum(df."sizeBytes") filter (where df."storageKey" is not null), 0) as "bytes"
           from "deliveryFile" df join "deliverySection" s on s."id" = df."sectionId" where s."deliveryId" = d."id"
       ) f
       cross join lateral (
         select count(*) filter (where ev."kind" = 'open') as "opens", count(*) filter (where ev."kind" = 'download') as "downloads"
           from "deliveryEvent" ev where ev."deliveryId" = d."id"
       ) e
      where d."ownerId" = $1
      order by d."updatedAt" desc
      limit $2`,
    [ownerId, limit],
  );
  return rows.map((r) => ({
    ...r,
    files: Number(r.files),
    bytes: Number(r.bytes),
    opens: Number(r.opens),
    downloads: Number(r.downloads),
    openRequests: Number(r.openRequests),
  }));
}

export type FeedKind = "signup" | "published" | "open" | "download" | "request";
export const feedKinds: Record<FeedKind, string> = {
  signup: "Sign-ups",
  published: "Published",
  open: "Opens",
  download: "Downloads",
  request: "Requests",
};

export type FeedItem = {
  kind: FeedKind;
  at: Date;
  userId: string | null;
  userName: string | null;
  deliveryTitle: string | null;
  clientName: string | null;
  fileName: string | null;
  device: string | null;
};

export const feedPageSize = 50;

// What happened across the app, newest first. Each source is read newest-first up to one page, then the pages are
// merged, so a page costs five small index reads. `before` pages back in time; `userId` narrows it to one person.
export async function listFeed(options: { kinds?: FeedKind[]; before?: Date | null; userId?: string | null; limit?: number }): Promise<FeedItem[]> {
  const kinds = new Set(options.kinds?.length ? options.kinds : (Object.keys(feedKinds) as FeedKind[]));
  const limit = options.limit ?? feedPageSize;
  const params: unknown[] = [options.before ?? null, options.userId ?? null, limit];
  const parts: string[] = [];
  if (kinds.has("signup")) {
    parts.push(`(select 'signup' as "kind", u."createdAt" as "at", u."id" as "userId", u."name" as "userName",
                        null as "deliveryTitle", null as "clientName", null as "fileName", null as "device"
                   from "user" u
                  where ($1::timestamptz is null or u."createdAt" < $1) and ($2::text is null or u."id" = $2)
                  order by u."createdAt" desc limit $3)`);
  }
  if (kinds.has("published")) {
    parts.push(`(select 'published', d."publishedAt", u."id", u."name", d."title", d."clientName", null, null
                   from "delivery" d join "user" u on u."id" = d."ownerId"
                  where d."publishedAt" is not null and ($1::timestamptz is null or d."publishedAt" < $1)
                    and ($2::text is null or d."ownerId" = $2)
                  order by d."publishedAt" desc limit $3)`);
  }
  for (const kind of ["open", "download"] as const) {
    if (!kinds.has(kind)) continue;
    parts.push(`(select e."kind", e."at", u."id", u."name", d."title", d."clientName", e."fileName", e."device"
                   from "deliveryEvent" e join "delivery" d on d."id" = e."deliveryId" join "user" u on u."id" = d."ownerId"
                  where e."kind" = '${kind}' and ($1::timestamptz is null or e."at" < $1) and ($2::text is null or d."ownerId" = $2)
                  order by e."at" desc limit $3)`);
  }
  if (kinds.has("request")) {
    parts.push(`(select 'request', r."createdAt", u."id", u."name", d."title", d."clientName", r."fileName", null
                   from "fileRequest" r join "delivery" d on d."id" = r."deliveryId" join "user" u on u."id" = d."ownerId"
                  where ($1::timestamptz is null or r."createdAt" < $1) and ($2::text is null or d."ownerId" = $2)
                  order by r."createdAt" desc limit $3)`);
  }
  const { rows } = await pool.query<FeedItem>(
    `select * from (${parts.join(" union all ")})
       as feed ("kind", "at", "userId", "userName", "deliveryTitle", "clientName", "fileName", "device")
      order by "at" desc limit $3`,
    params,
  );
  return rows;
}

export async function getHealth(): Promise<{ database: "ok" | "error"; latencyMs: number | null }> {
  const started = performance.now();
  try {
    await pool.query("select 1");
    return { database: "ok", latencyMs: Math.round(performance.now() - started) };
  } catch {
    return { database: "error", latencyMs: null };
  }
}
