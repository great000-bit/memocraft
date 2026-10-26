import type { ExDelivery, ExFile, ExFolder, ExplorerData } from "@/lib/library";

// The shape Memo Explorer works with: everything it can show is an Item, and every place it can open is a Loc.

export type Loc =
  | { kind: "files"; id: null }
  | { kind: "folder"; id: string }
  | { kind: "recent"; id: null }
  | { kind: "starred"; id: null }
  | { kind: "collections"; id: null }
  | { kind: "collection"; id: string }
  | { kind: "deliveries"; id: null }
  | { kind: "delivery"; id: string };

export const locKey = (loc: Loc) => (loc.id ? `${loc.kind}:${loc.id}` : loc.kind);

export function parseLoc(raw: string | null | undefined): Loc {
  const [kind, id] = (raw ?? "").split(":");
  if ((kind === "folder" || kind === "collection" || kind === "delivery") && id) return { kind, id };
  if (kind === "recent" || kind === "starred" || kind === "collections" || kind === "deliveries") return { kind, id: null };
  return { kind: "files", id: null };
}

type Base = { key: string; id: string; name: string; date: string; size: number; starred: boolean };

export type Item =
  | (Base & { type: "folder" | "collection"; folder: ExFolder; count: number; thumbs: string[] })
  | (Base & { type: "delivery"; delivery: ExDelivery; count: number; thumbs: string[] })
  | (Base & { type: "file"; file: ExFile });

export type Model = ReturnType<typeof buildModel>;

export function buildModel(data: ExplorerData) {
  const folderById = new Map<string, ExFolder>();
  const subfolders = new Map<string, ExFolder[]>();
  const collections: ExFolder[] = [];
  for (const folder of data.folders) {
    folderById.set(folder.id, folder);
    if (folder.kind === "collection") collections.push(folder);
    else {
      const parent = folder.parentId ?? "root";
      subfolders.set(parent, [...(subfolders.get(parent) ?? []), folder]);
    }
  }

  const fileById = new Map<string, ExFile>();
  const filesIn = new Map<string, ExFile[]>();
  for (const file of data.files) {
    fileById.set(file.id, file);
    const parent = file.folderId ?? "root";
    filesIn.set(parent, [...(filesIn.get(parent) ?? []), file]);
  }

  const collectionFiles = new Map<string, ExFile[]>();
  const collectionsOf = new Map<string, ExFolder[]>();
  for (const item of data.collectionItems) {
    const file = fileById.get(item.fileId);
    const collection = folderById.get(item.collectionId);
    if (!file || !collection) continue;
    collectionFiles.set(item.collectionId, [...(collectionFiles.get(item.collectionId) ?? []), file]);
    collectionsOf.set(item.fileId, [...(collectionsOf.get(item.fileId) ?? []), collection]);
  }

  const deliveryById = new Map(data.deliveries.map((delivery) => [delivery.id, delivery]));
  const deliveryFiles = new Map<string, ExFile[]>();
  const sentById = new Map<string, ExFile>();
  for (const file of data.deliveryFiles) {
    sentById.set(file.id, file);
    const id = file.deliveryId as string;
    deliveryFiles.set(id, [...(deliveryFiles.get(id) ?? []), file]);
  }

  // Every file under a folder, at any depth.
  const deepFiles = (folderId: string): ExFile[] => [
    ...(filesIn.get(folderId) ?? []),
    ...(subfolders.get(folderId) ?? []).flatMap((child) => deepFiles(child.id)),
  ];

  const pathOf = (folderId: string | null): ExFolder[] => {
    const path: ExFolder[] = [];
    let current = folderId ? folderById.get(folderId) : undefined;
    const seen = new Set<string>();
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      path.unshift(current);
      current = current.parentId ? folderById.get(current.parentId) : undefined;
    }
    return path;
  };

  const thumbsOf = (files: ExFile[]) =>
    files
      .filter((file) => file.thumb)
      .slice(0, 3)
      .map((file) => file.thumb as string);

  const folderItem = (folder: ExFolder): Item => {
    const files = folder.kind === "collection" ? (collectionFiles.get(folder.id) ?? []) : (filesIn.get(folder.id) ?? []);
    const count = files.length + (folder.kind === "folder" ? (subfolders.get(folder.id)?.length ?? 0) : 0);
    const thumbs = thumbsOf(folder.kind === "collection" ? files : deepFiles(folder.id));
    return {
      key: `${folder.kind}:${folder.id}`,
      type: folder.kind,
      id: folder.id,
      name: folder.name,
      date: folder.updatedAt,
      size: (folder.kind === "collection" ? files : deepFiles(folder.id)).reduce((sum, file) => sum + file.sizeBytes, 0),
      starred: folder.starred,
      folder,
      count,
      thumbs,
    };
  };

  const fileItem = (file: ExFile): Item => ({
    key: `file:${file.id}`,
    type: "file",
    id: file.id,
    name: file.name,
    date: file.createdAt,
    size: file.sizeBytes,
    starred: file.starred,
    file,
  });

  const deliveryItem = (delivery: ExDelivery): Item => {
    const files = deliveryFiles.get(delivery.id) ?? [];
    return {
      key: `delivery:${delivery.id}`,
      type: "delivery",
      id: delivery.id,
      name: delivery.title,
      date: delivery.updatedAt,
      size: files.reduce((sum, file) => sum + file.sizeBytes, 0),
      starred: false,
      delivery,
      count: files.length,
      thumbs: thumbsOf(files),
    };
  };

  return {
    folderById,
    subfolders,
    collections,
    fileById,
    sentById,
    filesIn,
    collectionFiles,
    collectionsOf,
    deliveryById,
    deliveryFiles,
    deepFiles,
    pathOf,
    folderItem,
    fileItem,
    deliveryItem,
  };
}

// What a place holds. A search looks through the place and everything below it.
export function itemsAt(model: Model, data: ExplorerData, loc: Loc, query: string): Item[] {
  const q = query.trim().toLowerCase();
  const match = (name: string) => !q || name.toLowerCase().includes(q);

  if (q) {
    if (loc.kind === "files" || loc.kind === "folder") {
      const walk = (id: string): Item[] =>
        (model.subfolders.get(id) ?? []).flatMap((folder) => [
          ...(match(folder.name) ? [model.folderItem(folder)] : []),
          ...walk(folder.id),
        ]);
      const root = loc.kind === "folder" ? loc.id : "root";
      const files = loc.kind === "folder" ? model.deepFiles(loc.id) : data.files;
      return [...walk(root), ...files.filter((file) => match(file.name)).map(model.fileItem)];
    }
    if (loc.kind === "deliveries" || loc.kind === "delivery") {
      const files = loc.kind === "delivery" ? (model.deliveryFiles.get(loc.id) ?? []) : data.deliveryFiles;
      const deliveries =
        loc.kind === "deliveries" ? data.deliveries.filter((delivery) => match(delivery.title)).map(model.deliveryItem) : [];
      return [...deliveries, ...files.filter((file) => match(file.name)).map(model.fileItem)];
    }
  }

  switch (loc.kind) {
    case "files":
    case "folder": {
      const id = loc.id ?? "root";
      return [...(model.subfolders.get(id) ?? []).map(model.folderItem), ...(model.filesIn.get(id) ?? []).map(model.fileItem)].filter(
        (item) => match(item.name),
      );
    }
    case "recent": {
      const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
      return data.files
        .filter((file) => Date.parse(file.createdAt) >= since && match(file.name))
        .slice(0, 300)
        .map(model.fileItem);
    }
    case "starred":
      return [
        ...data.folders.filter((folder) => folder.starred && match(folder.name)).map(model.folderItem),
        ...data.files.filter((file) => file.starred && match(file.name)).map(model.fileItem),
      ];
    case "collections":
      return model.collections.filter((folder) => match(folder.name)).map(model.folderItem);
    case "collection":
      return (model.collectionFiles.get(loc.id) ?? []).filter((file) => match(file.name)).map(model.fileItem);
    case "deliveries":
      return data.deliveries.filter((delivery) => match(delivery.title)).map(model.deliveryItem);
    case "delivery":
      return (model.deliveryFiles.get(loc.id) ?? []).filter((file) => match(file.name)).map(model.fileItem);
  }
}

export type SortKey = "name" | "date" | "size" | "type";

const typeOf = (item: Item) => (item.type === "file" ? (item.file.ext ?? "") : "");

export function sortItems(items: Item[], key: SortKey, dir: 1 | -1): Item[] {
  const compare = (a: Item, b: Item) => {
    switch (key) {
      case "date":
        return Date.parse(a.date) - Date.parse(b.date);
      case "size":
        return a.size - b.size;
      case "type":
        return typeOf(a).localeCompare(typeOf(b)) || a.name.localeCompare(b.name, undefined, { numeric: true });
      default:
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
    }
  };
  // Folders, collections and deliveries always come before files, like a desktop file manager.
  const rank = (item: Item) => (item.type === "file" ? 1 : 0);
  return [...items].sort((a, b) => rank(a) - rank(b) || compare(a, b) * dir);
}

export type Group = { key: string; label: string; items: Item[] };

const DAY = 24 * 60 * 60 * 1000;

function dateBucket(iso: string, now: Date): { key: string; label: string; order: number } {
  const time = Date.parse(iso);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekday = (new Date(today).getDay() + 6) % 7;
  const weekStart = today - weekday * DAY;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  if (time >= today) return { key: "today", label: "Today", order: 0 };
  if (time >= today - DAY) return { key: "yesterday", label: "Yesterday", order: 1 };
  if (time >= weekStart) return { key: "week", label: "Earlier this week", order: 2 };
  if (time >= weekStart - 7 * DAY) return { key: "lastweek", label: "Last week", order: 3 };
  if (time >= monthStart) return { key: "month", label: "Earlier this month", order: 4 };
  if (time >= lastMonthStart) return { key: "lastmonth", label: "Last month", order: 5 };
  const date = new Date(time);
  return {
    key: `m${date.getFullYear()}-${date.getMonth()}`,
    label: date.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
    order: 6 + (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth()),
  };
}

// Folders first under their own heading, then files by when they arrived: Today, Yesterday, Earlier this week…
export function groupItems(items: Item[], byDate: boolean): Group[] {
  if (!byDate) return items.length ? [{ key: "all", label: "", items }] : [];
  const now = new Date();
  const containers = items.filter((item) => item.type !== "file");
  const groups = new Map<string, Group & { order: number }>();
  for (const item of items) {
    if (item.type !== "file") continue;
    const bucket = dateBucket(item.date, now);
    const group = groups.get(bucket.key) ?? { key: bucket.key, label: bucket.label, order: bucket.order, items: [] };
    group.items.push(item);
    groups.set(bucket.key, group);
  }
  const label = containers.every((item) => item.type === "delivery")
    ? "Deliveries"
    : containers.every((item) => item.type === "collection")
      ? "Collections"
      : "Folders";
  return [
    ...(containers.length ? [{ key: "containers", label, items: containers }] : []),
    ...[...groups.values()].sort((a, b) => a.order - b.order),
  ];
}
