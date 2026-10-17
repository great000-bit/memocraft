import { randomBytes } from "node:crypto";
import { pool } from "./auth";

export type DeliveryFile = {
  id: string;
  name: string;
  note: string | null;
  sizeBytes: number | null;
  mimeType: string | null;
  storageKey: string | null;
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
};

export type DeliverySummary = {
  id: string;
  title: string;
  clientName: string | null;
  status: "draft" | "published";
  updatedAt: Date;
  fileCount: number;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: unknown): value is string => typeof value === "string" && uuidPattern.test(value);

// 32 symbols, no look-alikes. Twelve of them carry 60 bits, which is what keeps a client link unguessable.
const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";

export function makeSlug(title: string): string {
  const words = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
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
};

async function loadSections(deliveryId: string): Promise<DeliverySection[]> {
  const sections = await pool.query<{ id: string; title: string; note: string | null }>(
    `select "id", "title", "note" from "deliverySection" where "deliveryId" = $1 order by "position", "id"`,
    [deliveryId],
  );
  const files = await pool.query<DeliveryFile & { sectionId: string; sizeBytes: string | null }>(
    `select f."id", f."sectionId", f."name", f."note", f."sizeBytes", f."mimeType", f."storageKey"
       from "deliveryFile" f
       join "deliverySection" s on s."id" = f."sectionId"
      where s."deliveryId" = $1
      order by f."position", f."createdAt", f."id"`,
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
        storageKey: file.storageKey,
      })),
  }));
}

export async function listDeliveries(ownerId: string, limit = 50): Promise<DeliverySummary[]> {
  const { rows } = await pool.query<DeliverySummary & { fileCount: string }>(
    `select d."id", d."title", d."clientName", d."status", d."updatedAt",
            (select count(*) from "deliveryFile" f join "deliverySection" s on s."id" = f."sectionId"
              where s."deliveryId" = d."id") as "fileCount"
       from "delivery" d
      where d."ownerId" = $1
      order by d."updatedAt" desc
      limit $2`,
    [ownerId, limit],
  );
  return rows.map((row) => ({ ...row, fileCount: Number(row.fileCount) }));
}

export async function getDeliveryForOwner(id: string, ownerId: string): Promise<Delivery | null> {
  if (!isUuid(id)) return null;
  const { rows } = await pool.query<DeliveryRow>(
    `select "id", "title", "clientName", "message", "slug", "status", "updatedAt", "publishedAt"
       from "delivery" where "id" = $1 and "ownerId" = $2`,
    [id, ownerId],
  );
  if (!rows[0]) return null;
  return { ...rows[0], sections: await loadSections(rows[0].id) };
}

// What a client sees: only published deliveries, found by slug, with the sender's name.
export async function getPublishedBySlug(slug: string): Promise<(Delivery & { senderName: string }) | null> {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const { rows } = await pool.query<DeliveryRow & { senderName: string }>(
    `select d."id", d."title", d."clientName", d."message", d."slug", d."status", d."updatedAt", d."publishedAt",
            u."name" as "senderName"
       from "delivery" d join "user" u on u."id" = d."ownerId"
      where d."slug" = $1 and d."status" = 'published'`,
    [slug],
  );
  if (!rows[0]) return null;
  return { ...rows[0], sections: await loadSections(rows[0].id) };
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
