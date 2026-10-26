import { pool } from "./auth";
import { linkState, type LinkState } from "./deliveries";
import { presignThumb, storageConfigured } from "./storage";
import { storageLimits } from "./storage-limits";
import { storageUsed } from "./storage-usage";

// Everything Memo Explorer shows, loaded in one go so moving between folders is instant in the browser. Dates are
// sent as ISO strings and thumbnails as signed links (signing needs no network).

export type ExFolder = {
  id: string;
  parentId: string | null;
  kind: "folder" | "collection";
  name: string;
  starred: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ExFile = {
  id: string;
  // "library" files are the creative's own; "delivery" files are the ones already inside a delivery (read-only here).
  source: "library" | "delivery";
  folderId: string | null;
  deliveryId: string | null;
  name: string;
  ext: string | null;
  sizeBytes: number;
  mimeType: string | null;
  thumb: string | null;
  starred: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ExDelivery = {
  id: string;
  title: string;
  clientName: string | null;
  state: LinkState;
  createdAt: string;
  updatedAt: string;
};

export type ExplorerData = {
  folders: ExFolder[];
  files: ExFile[];
  collectionItems: { collectionId: string; fileId: string; addedAt: string }[];
  deliveries: ExDelivery[];
  deliveryFiles: ExFile[];
  usedBytes: number;
  limitBytes: number;
  storageReady: boolean;
};

const iso = (value: Date | string) => new Date(value).toISOString();

async function sign(key: string | null): Promise<string | null> {
  if (!key || !storageConfigured()) return null;
  try {
    return await presignThumb(key);
  } catch {
    return null;
  }
}

export async function loadExplorer(ownerId: string): Promise<ExplorerData> {
  const [folders, files, items, deliveries, deliveryFiles, usedBytes] = await Promise.all([
    pool.query<{
      id: string;
      parentId: string | null;
      kind: "folder" | "collection";
      name: string;
      starred: boolean;
      createdAt: Date;
      updatedAt: Date;
    }>(
      `select "id", "parentId", "kind", "name", "starred", "createdAt", "updatedAt"
         from "libraryFolder" where "ownerId" = $1 order by lower("name")`,
      [ownerId],
    ),
    pool.query<{
      id: string;
      folderId: string | null;
      name: string;
      ext: string | null;
      sizeBytes: string;
      mimeType: string | null;
      thumbKey: string | null;
      starred: boolean;
      createdAt: Date;
      updatedAt: Date;
    }>(
      `select "id", "folderId", "name", "ext", "sizeBytes", "mimeType", "thumbKey", "starred", "createdAt", "updatedAt"
         from "libraryFile" where "ownerId" = $1 and "storageKey" is not null order by "createdAt" desc limit 5000`,
      [ownerId],
    ),
    pool.query<{ collectionId: string; fileId: string; addedAt: Date }>(
      `select i."collectionId", i."fileId", i."addedAt"
         from "libraryCollectionItem" i join "libraryFolder" c on c."id" = i."collectionId"
        where c."ownerId" = $1`,
      [ownerId],
    ),
    pool.query<{
      id: string;
      title: string;
      clientName: string | null;
      status: "draft" | "published";
      publishedAt: Date | null;
      expired: boolean;
      createdAt: Date;
      updatedAt: Date;
    }>(
      `select "id", "title", "clientName", "status", "publishedAt", "createdAt", "updatedAt",
              ("expiresAt" is not null and "expiresAt" <= now()) as "expired"
         from "delivery" where "ownerId" = $1 order by "updatedAt" desc limit 500`,
      [ownerId],
    ),
    pool.query<{
      id: string;
      deliveryId: string;
      name: string;
      ext: string | null;
      sizeBytes: string;
      mimeType: string | null;
      thumbKey: string | null;
      createdAt: Date;
      replacedAt: Date | null;
    }>(
      `select f."id", s."deliveryId", f."name", f."ext", f."sizeBytes", f."mimeType", f."thumbKey", f."createdAt", f."replacedAt"
         from "deliveryFile" f
         join "deliverySection" s on s."id" = f."sectionId"
         join "delivery" d on d."id" = s."deliveryId"
        where d."ownerId" = $1 and f."storageKey" is not null
        order by s."position", f."position" limit 5000`,
      [ownerId],
    ),
    storageUsed(ownerId),
  ]);

  const libraryFiles = await Promise.all(
    files.rows.map(
      async (row): Promise<ExFile> => ({
        id: row.id,
        source: "library",
        folderId: row.folderId,
        deliveryId: null,
        name: row.name,
        ext: row.ext,
        sizeBytes: Number(row.sizeBytes),
        mimeType: row.mimeType,
        thumb: await sign(row.thumbKey),
        starred: row.starred,
        createdAt: iso(row.createdAt),
        updatedAt: iso(row.updatedAt),
      }),
    ),
  );

  const sentFiles = await Promise.all(
    deliveryFiles.rows.map(
      async (row): Promise<ExFile> => ({
        id: row.id,
        source: "delivery",
        folderId: null,
        deliveryId: row.deliveryId,
        // Delivery files are named without their extension, which is added back on download.
        name: row.ext ? `${row.name}.${row.ext}` : row.name,
        ext: row.ext,
        sizeBytes: Number(row.sizeBytes),
        mimeType: row.mimeType,
        thumb: await sign(row.thumbKey),
        starred: false,
        createdAt: iso(row.createdAt),
        updatedAt: iso(row.replacedAt ?? row.createdAt),
      }),
    ),
  );

  return {
    folders: folders.rows.map((row) => ({ ...row, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) })),
    files: libraryFiles,
    collectionItems: items.rows.map((row) => ({ ...row, addedAt: iso(row.addedAt) })),
    deliveries: deliveries.rows.map((row) => ({
      id: row.id,
      title: row.title,
      clientName: row.clientName,
      state: linkState(row),
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    })),
    deliveryFiles: sentFiles,
    usedBytes,
    limitBytes: storageLimits.accountBytes,
    storageReady: storageConfigured(),
  };
}
