import { randomBytes } from "node:crypto";
import { pool } from "./auth";
import type { Brand } from "./brand";
import { readCover, type Cover } from "./cover";
import { brandFrom, clientLogoPath, type Studio } from "./studio";

export type DeliveryFile = {
  id: string;
  name: string;
  note: string | null;
  sizeBytes: number | null;
  mimeType: string | null;
  ext: string | null;
  // Storage key of the preview image, when there is one. Only the owner's editor turns it into a link.
  thumbKey: string | null;
  // Attached means the file is in storage and checked. Unattached rows are never shown to clients.
  attached: boolean;
  // True while an upload for this row was started and not finished.
  uploading: boolean;
  // How many times a client started this download. Only the owner's editor shows it.
  downloads: number;
  // When the file was added, and when it was last swapped for a new one. The client page compares these with the
  // moment the delivery was first published to mark a file New or Updated.
  addedAt: Date;
  replacedAt: Date | null;
  // Earlier versions kept in storage. Filled in for the owner's editor only.
  versions: FileVersion[];
  // Size of the AI-enhanced copy, when there is one. Clients are given that copy first, labelled Enhanced.
  enhancedBytes: number | null;
  // An enhance in progress, or the reason the last one failed. The owner's editor only.
  enhancing: { state: "running" } | { state: "failed"; error: string } | null;
};

export type FileVersion = {
  id: string;
  sizeBytes: number;
  ext: string | null;
  replacedAt: Date;
};

// A note the creative posted about what changed. The newest shows above the files on the client page.
export type DeliveryUpdate = {
  id: string;
  note: string;
  createdAt: Date;
};

export type DeliverySection = {
  id: string;
  title: string;
  note: string | null;
  files: DeliveryFile[];
};

export type Delivery = {
  id: string;
  title: string;
  clientName: string | null;
  message: string | null;
  slug: string;
  status: "draft" | "published";
  updatedAt: Date;
  publishedAt: Date | null;
  sections: DeliverySection[];
  updates: DeliveryUpdate[];
  // The cover a client sees first. Always filled in: a delivery never designed gets the defaults.
  cover: Cover;
};

// What the owner sees about the link itself: when it stops working, and whether it asks for a password.
export type OwnerDelivery = Delivery & { expiresAt: Date | null; expired: boolean; hasPassword: boolean };

// The state of a client link, in the words the owner sees. A paused link is one that was sent and switched off.
export type LinkState = "draft" | "live" | "paused" | "expired";

export function linkState(delivery: { status: "draft" | "published"; publishedAt: Date | null; expired: boolean }): LinkState {
  if (delivery.status === "draft") return delivery.publishedAt ? "paused" : "draft";
  return delivery.expired ? "expired" : "live";
}

export type DeliverySummary = {
  id: string;
  title: string;
  clientName: string | null;
  status: "draft" | "published";
  updatedAt: Date;
  publishedAt: Date | null;
  expired: boolean;
  fileCount: number;
  opens: number;
  downloads: number;
};

// A link a client can use right now: published, and not past its expiry date.
const live = `d."status" = 'published' and (d."expiresAt" is null or d."expiresAt" > now())`;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: unknown): value is string => typeof value === "string" && uuidPattern.test(value);

// 32 symbols, no look-alikes. Twelve of them carry 60 bits, which is what keeps a client link unguessable.
const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";

export function makeSlug(title: string): string {
  const words = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
    .replace(/-+$/g, "");
  const bytes = randomBytes(12);
  let token = "";
  for (const byte of bytes) token += alphabet[byte % alphabet.length];
  return words ? `${words}-${token}` : token;
}

type DeliveryRow = {
  id: string;
  title: string;
  clientName: string | null;
  message: string | null;
  slug: string;
  status: "draft" | "published";
  updatedAt: Date;
  publishedAt: Date | null;
  cover: unknown;
};

const withCover = <T extends DeliveryRow>(row: T): Omit<T, "cover"> & { cover: Cover } => ({ ...row, cover: readCover(row.cover, row) });

async function loadSections(deliveryId: string, onlyAttached: boolean): Promise<DeliverySection[]> {
  const sections = await pool.query<{ id: string; title: string; note: string | null }>(
    `select "id", "title", "note" from "deliverySection" where "deliveryId" = $1 order by "position", "id"`,
    [deliveryId],
  );
  const files = await pool.query<{
    id: string;
    sectionId: string;
    name: string;
    note: string | null;
    sizeBytes: string | null;
    mimeType: string | null;
    ext: string | null;
    thumbKey: string | null;
    attached: boolean;
    uploading: boolean;
    downloads: string;
    addedAt: Date;
    replacedAt: Date | null;
    enhancedBytes: string | null;
    enhanceJob: { error?: string } | null;
  }>(
    `select f."id", f."sectionId", f."name", f."note", f."sizeBytes", f."mimeType", f."ext", f."thumbKey",
            case when f."enhancedKey" is not null then f."enhancedBytes" end as "enhancedBytes", f."enhanceJob",
            f."createdAt" as "addedAt", f."replacedAt",
            f."storageKey" is not null as "attached", f."pending" is not null as "uploading",
            (select count(*) from "deliveryEvent" e where e."fileId" = f."id" and e."kind" = 'download') as "downloads"
       from "deliveryFile" f
       join "deliverySection" s on s."id" = f."sectionId"
      where s."deliveryId" = $1 and ($2 = false or f."storageKey" is not null)
      order by f."position", f."createdAt", f."id"`,
    [deliveryId, onlyAttached],
  );
  // Earlier versions are the owner's business; a client's page never loads them.
  const versions = onlyAttached
    ? { rows: [] as { id: string; fileId: string; sizeBytes: string; ext: string | null; replacedAt: Date }[] }
    : await pool.query<{ id: string; fileId: string; sizeBytes: string; ext: string | null; replacedAt: Date }>(
        `select v."id", v."fileId", v."sizeBytes", v."ext", v."replacedAt"
           from "deliveryFileVersion" v
           join "deliveryFile" f on f."id" = v."fileId"
           join "deliverySection" s on s."id" = f."sectionId"
          where s."deliveryId" = $1
          order by v."replacedAt" desc, v."id"`,
        [deliveryId],
      );
  return sections.rows.map((section) => ({
    ...section,
    files: files.rows
      .filter((file) => file.sectionId === section.id)
      .map((file) => ({
        id: file.id,
        name: file.name,
        note: file.note,
        sizeBytes: file.sizeBytes === null ? null : Number(file.sizeBytes),
        mimeType: file.mimeType,
        ext: file.ext,
        thumbKey: file.thumbKey,
        attached: file.attached,
        uploading: file.uploading,
        downloads: Number(file.downloads),
        addedAt: file.addedAt,
        replacedAt: file.replacedAt,
        versions: versions.rows
          .filter((version) => version.fileId === file.id)
          .map((version) => ({
            id: version.id,
            sizeBytes: Number(version.sizeBytes),
            ext: version.ext,
            replacedAt: version.replacedAt,
          })),
        enhancedBytes: file.enhancedBytes === null ? null : Number(file.enhancedBytes),
        enhancing: onlyAttached || !file.enhanceJob
          ? null
          : file.enhanceJob.error
            ? { state: "failed" as const, error: file.enhanceJob.error }
            : { state: "running" as const },
      })),
  }));
}

async function loadUpdates(deliveryId: string): Promise<DeliveryUpdate[]> {
  const { rows } = await pool.query<DeliveryUpdate>(
    `select "id", "note", "createdAt" from "deliveryUpdate" where "deliveryId" = $1 order by "createdAt" desc, "id" limit 30`,
    [deliveryId],
  );
  return rows;
}

export async function listDeliveries(ownerId: string, limit = 50): Promise<DeliverySummary[]> {
  const { rows } = await pool.query<
    Omit<DeliverySummary, "fileCount" | "opens" | "downloads"> & { fileCount: string; opens: string; downloads: string }
  >(
    `select d."id", d."title", d."clientName", d."status", d."updatedAt", d."publishedAt",
            (d."expiresAt" is not null and d."expiresAt" <= now()) as "expired",
            (select count(*) from "deliveryFile" f join "deliverySection" s on s."id" = f."sectionId"
              where s."deliveryId" = d."id") as "fileCount",
            ev."opens", ev."downloads"
       from "delivery" d
       cross join lateral (
         select count(*) filter (where e."kind" = 'open') as "opens",
                count(*) filter (where e."kind" = 'download') as "downloads"
           from "deliveryEvent" e where e."deliveryId" = d."id"
       ) ev
      where d."ownerId" = $1
      order by d."updatedAt" desc
      limit $2`,
    [ownerId, limit],
  );
  return rows.map((row) => ({
    ...row,
    fileCount: Number(row.fileCount),
    opens: Number(row.opens),
    downloads: Number(row.downloads),
  }));
}

export async function getDeliveryForOwner(id: string, ownerId: string): Promise<OwnerDelivery | null> {
  if (!isUuid(id)) return null;
  const { rows } = await pool.query<DeliveryRow & { expiresAt: Date | null; expired: boolean; hasPassword: boolean }>(
    `select "id", "title", "clientName", "message", "slug", "status", "updatedAt", "publishedAt", "cover", "expiresAt",
            ("expiresAt" is not null and "expiresAt" <= now()) as "expired",
            "passwordHash" is not null as "hasPassword"
       from "delivery" where "id" = $1 and "ownerId" = $2`,
    [id, ownerId],
  );
  if (!rows[0]) return null;
  const [sections, updates] = await Promise.all([loadSections(rows[0].id, false), loadUpdates(rows[0].id)]);
  return { ...withCover(rows[0]), sections, updates };
}

// The sender as a client sees them: the studio name when one is set, else the person's own name, and the logo.
const senderColumns = `coalesce(st."name", u."name") as "senderName",
            st."name", st."logoVersion", st."logoWidth", st."logoHeight"`;
const senderJoins = `join "user" u on u."id" = d."ownerId" left join "studio" st on st."userId" = d."ownerId"`;

// What a client sees: only deliveries whose link is live, found by slug, with the sender's name and brand. Whether
// the client has typed the password is the caller's question (see getLinkBySlug and passesPassword).
export async function getPublishedBySlug(slug: string): Promise<(Delivery & { senderName: string; brand: Brand }) | null> {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const { rows } = await pool.query<DeliveryRow & Studio & { senderName: string }>(
    `select d."id", d."title", d."clientName", d."message", d."slug", d."status", d."updatedAt", d."publishedAt", d."cover",
            ${senderColumns}
       from "delivery" d ${senderJoins}
      where d."slug" = $1 and ${live}`,
    [slug],
  );
  if (!rows[0]) return null;
  const { name, logoVersion, logoWidth, logoHeight, ...row } = rows[0];
  const [sections, updates] = await Promise.all([loadSections(row.id, true), loadUpdates(row.id)]);
  return { ...withCover(row), sections, updates, brand: brandFrom({ name, logoVersion, logoWidth, logoHeight }, clientLogoPath(slug)) };
}

// Enough to attribute an event to a delivery: found by slug, only while its link is live.
export async function getPublishedRef(slug: string): Promise<{ id: string; ownerId: string; passwordHash: string | null } | null> {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const { rows } = await pool.query<{ id: string; ownerId: string; passwordHash: string | null }>(
    `select d."id", d."ownerId", d."passwordHash" from "delivery" d where d."slug" = $1 and ${live}`,
    [slug],
  );
  return rows[0] ?? null;
}

// A file a client may download: attached, in a delivery whose link is live right now.
export async function getPublishedFile(slug: string, fileId: string) {
  if (!/^[a-z0-9-]{1,80}$/.test(slug) || !isUuid(fileId)) return null;
  const { rows } = await pool.query<{
    name: string;
    ext: string | null;
    mimeType: string | null;
    storageKey: string;
    enhancedKey: string | null;
    deliveryId: string;
    ownerId: string;
    passwordHash: string | null;
  }>(
    `select f."name", f."ext", f."mimeType", f."storageKey", f."enhancedKey", d."id" as "deliveryId", d."ownerId", d."passwordHash"
       from "deliveryFile" f
       join "deliverySection" s on s."id" = f."sectionId"
       join "delivery" d on d."id" = s."deliveryId"
      where f."id" = $1 and d."slug" = $2 and ${live} and f."storageKey" is not null`,
    [fileId, slug],
  );
  return rows[0] ?? null;
}

// The preview picture of a file a client may see: attached, with a thumbnail, in a delivery whose link is live.
export async function getPublishedThumb(slug: string, fileId: string) {
  if (!/^[a-z0-9-]{1,80}$/.test(slug) || !isUuid(fileId)) return null;
  const { rows } = await pool.query<{ thumbKey: string; deliveryId: string; passwordHash: string | null }>(
    `select f."thumbKey", d."id" as "deliveryId", d."passwordHash"
       from "deliveryFile" f
       join "deliverySection" s on s."id" = f."sectionId"
       join "delivery" d on d."id" = s."deliveryId"
      where f."id" = $1 and d."slug" = $2 and ${live}
        and f."storageKey" is not null and f."thumbKey" is not null`,
    [fileId, slug],
  );
  return rows[0] ?? null;
}

export type LinkGate = {
  id: string;
  ownerId: string;
  senderName: string;
  brand: Brand;
  expired: boolean;
  passwordHash: string | null;
  // Minutes until a locked link takes guesses again; null when it is not locked.
  lockedMinutes: number | null;
};

// What the client page needs to decide between the delivery, a password form and an "expired" notice. Found by
// slug while the delivery is published; an expired link is still found, so the client can be told why it stopped.
export async function getLinkBySlug(slug: string): Promise<LinkGate | null> {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const { rows } = await pool.query<Omit<LinkGate, "brand"> & Studio>(
    `select d."id", d."ownerId", ${senderColumns},
            (d."expiresAt" is not null and d."expiresAt" <= now()) as "expired",
            d."passwordHash",
            case when d."passwordLockedUntil" > now()
                 then ceil(extract(epoch from d."passwordLockedUntil" - now()) / 60)::int end as "lockedMinutes"
       from "delivery" d ${senderJoins}
      where d."slug" = $1 and d."status" = 'published'`,
    [slug],
  );
  if (!rows[0]) return null;
  const { name, logoVersion, logoWidth, logoHeight, ...gate } = rows[0];
  return { ...gate, brand: brandFrom({ name, logoVersion, logoWidth, logoHeight }, clientLogoPath(slug)) };
}

// The name a client's device saves the file under: the label the creative chose, with the original extension kept.
export function downloadName(name: string, ext: string | null): string {
  const base = name.trim().replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "-") || "file";
  if (!ext || base.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) return base;
  return `${base}.${ext}`;
}

export async function createDeliveryRow(ownerId: string, title: string, clientName: string | null) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    let id: string | null = null;
    // A collision on a 60-bit token is not expected; retrying keeps the rare case invisible.
    for (let attempt = 0; attempt < 3 && !id; attempt++) {
      const result = await client.query<{ id: string }>(
        `insert into "delivery" ("ownerId", "title", "clientName", "slug") values ($1, $2, $3, $4)
         on conflict ("slug") do nothing returning "id"`,
        [ownerId, title, clientName, makeSlug(title)],
      );
      id = result.rows[0]?.id ?? null;
    }
    if (!id) throw new Error("Could not create a unique link.");
    await client.query(`insert into "deliverySection" ("deliveryId", "title", "position") values ($1, 'Final files', 0)`, [id]);
    await client.query("commit");
    return id;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
