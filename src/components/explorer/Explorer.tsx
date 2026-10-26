"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { ExFile, ExFolder, ExplorerData } from "@/lib/library";
import {
  addToCollection,
  copyToLibrary,
  createFolder,
  deleteItems,
  moveItems,
  removeFromCollection,
  renameItem,
  sendAsDelivery,
  setStarred,
  type SendInput,
} from "@/lib/library-actions";
import { formatSize } from "@/lib/storage-limits";
import { DocGlyph, ExIcon, fileKind, kindLabel, type ExIconName } from "./ExplorerIcons";
import { buildModel, groupItems, itemsAt, locKey, parseLoc, sortItems, type Item, type Loc, type Model, type SortKey } from "./model";
import { useLibraryUploads, type UploadTarget } from "./useLibraryUploads";
import styles from "./Explorer.module.css";

type View = "tiles" | "grid" | "list";
type Prefs = { view: View; sort: SortKey; dir: 1 | -1; group: boolean; preview: boolean; open: string[] };

const defaultPrefs: Prefs = { view: "tiles", sort: "date", dir: -1, group: true, preview: true, open: ["files"] };
const PREFS_KEY = "mc-explorer";
const DRAG_TYPE = "application/x-memocraft-items";

type Dialog =
  | null
  | { kind: "name"; title: string; label: string; initial: string; confirm: string; submit: (value: string) => Promise<string | null> }
  | { kind: "move"; title: string; confirm: string; exclude: Set<string>; submit: (target: string | null) => Promise<string | null> }
  | { kind: "confirm"; title: string; body: string; confirm: string; submit: () => Promise<string | null> };

type Menu = { x: number; y: number; keys: string[] } | null;
type Toast = { id: number; text: string; tone: "ok" | "error" } | null;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function readPrefs(): Prefs {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}");
    return { ...defaultPrefs, ...saved };
  } catch {
    return defaultPrefs;
  }
}

function fileHref(file: ExFile, view = false) {
  return `/api/explorer/files/${file.source}/${file.id}${view ? "?view=1" : ""}`;
}

// ---------- Glyphs ----------

// A folder drawn in layers: the back with its tab, up to three pictures tucked inside, then the front pocket.
function FolderArt({ thumbs, tone, badge }: { thumbs: string[]; tone: "folder" | "delivery"; badge?: React.ReactNode }) {
  return (
    <span className={styles.folderArt} data-tone={tone}>
      <svg className={styles.folderBack} viewBox="0 0 120 96" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={`exb-${tone}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={tone === "folder" ? "#0c5a50" : "#2a302f"} />
            <stop offset="1" stopColor={tone === "folder" ? "#073a34" : "#161a19"} />
          </linearGradient>
        </defs>
        <path d="M6 14a8 8 0 0 1 8-8h28c3 0 5 1 7 3l6 6h51a8 8 0 0 1 8 8v58a8 8 0 0 1-8 8H14a8 8 0 0 1-8-8z" fill={`url(#exb-${tone})`} />
      </svg>
      {thumbs.map((src, index) => (
        // eslint-disable-next-line @next/next/no-img-element -- a signed storage link
        <img key={src} src={src} alt="" className={styles.folderPeek} data-i={index} loading="lazy" draggable={false} />
      ))}
      <svg className={styles.folderFront} viewBox="0 0 120 96" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={`exf-${tone}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={tone === "folder" ? "#17a08b" : "#4a5452"} />
            <stop offset="1" stopColor={tone === "folder" ? "#0b6b5d" : "#2b3231"} />
          </linearGradient>
        </defs>
        <path d="M3 42a8 8 0 0 1 8-8h98a8 8 0 0 1 8 8v38a8 8 0 0 1-8 8H11a8 8 0 0 1-8-8z" fill={`url(#exf-${tone})`} />
        <path d="M11 35h98" className={styles.folderShine} />
      </svg>
      {badge && <span className={styles.folderBadge}>{badge}</span>}
    </span>
  );
}

// A collection is a fanned stack of its pictures with an amber edge, so it never reads as a folder.
function CollectionArt({ thumbs }: { thumbs: string[] }) {
  const cards = [0, 1, 2];
  return (
    <span className={styles.stackArt}>
      {cards.map((index) => {
        const src = thumbs[2 - index] ?? thumbs[0];
        return (
          <span key={index} className={styles.stackCard} data-i={index}>
            {/* eslint-disable-next-line @next/next/no-img-element -- a signed storage link */}
            {src ? <img src={src} alt="" loading="lazy" draggable={false} /> : <ExIcon name="collection" size={26} />}
          </span>
        );
      })}
    </span>
  );
}

function FileArt({ file }: { file: ExFile }) {
  const kind = fileKind(file.mimeType, file.ext);
  if (file.thumb) {
    return (
      <span className={styles.photoArt}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a signed storage link */}
        <img src={file.thumb} alt="" loading="lazy" draggable={false} />
        {kind === "video" && (
          <span className={styles.playBadge} aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M9 7v10l8-5z" fill="currentColor" />
            </svg>
          </span>
        )}
      </span>
    );
  }
  return (
    <span className={styles.docArt} data-kind={kind}>
      <DocGlyph ext={file.ext} kind={kind} />
    </span>
  );
}

function ItemArt({ item }: { item: Item }) {
  if (item.type === "file") return <FileArt file={item.file} />;
  if (item.type === "collection") return <CollectionArt thumbs={item.thumbs} />;
  if (item.type === "delivery") {
    return <FolderArt thumbs={item.thumbs} tone="delivery" badge={<span className={styles.stateDot} data-state={item.delivery.state} />} />;
  }
  return <FolderArt thumbs={item.thumbs} tone="folder" />;
}

function SmallGlyph({ item }: { item: Item }) {
  if (item.type === "file") {
    if (item.file.thumb) {
      // eslint-disable-next-line @next/next/no-img-element -- a signed storage link
      return <img src={item.file.thumb} alt="" className={styles.rowThumb} loading="lazy" draggable={false} />;
    }
    return (
      <span className={styles.rowDoc} data-kind={fileKind(item.file.mimeType, item.file.ext)}>
        {(item.file.ext ?? "file").slice(0, 4)}
      </span>
    );
  }
  const icon: ExIconName = item.type === "collection" ? "collection" : item.type === "delivery" ? "delivery" : "folder";
  return (
    <span className={styles.rowFolder} data-tone={item.type}>
      <ExIcon name={icon} filled={item.type === "folder"} size={18} />
    </span>
  );
}

function describe(item: Item): string {
  if (item.type === "file") return kindLabel[fileKind(item.file.mimeType, item.file.ext)];
  if (item.type === "collection") return "Collection";
  if (item.type === "delivery") return "Delivery";
  return "Folder";
}

function metaLine(item: Item): string {
  if (item.type === "file") return formatSize(item.size);
  return plural(item.count, item.type === "delivery" || item.type === "collection" ? "file" : "item");
}

// ---------- Main ----------

export function Explorer({ data, initialAt }: { data: ExplorerData; initialAt: string | null }) {
  const router = useRouter();
  const model = useMemo(() => buildModel(data), [data]);
  const [prefs, setPrefs] = useState<Prefs>(readPrefs);
  const [loc, setLoc] = useState<Loc>(() => parseLoc(initialAt));
  const [back, setBack] = useState<Loc[]>([]);
  const [forward, setForward] = useState<Loc[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focus, setFocus] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [menu, setMenu] = useState<Menu>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);
  const [treeOpen, setTreeOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [band, setBand] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [busy, startBusy] = useTransition();
  const uploads = useLibraryUploads();
  const content = useRef<HTMLDivElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const pickUpload = useCallback(() => uploadInput.current?.click(), []);

  const savePrefs = useCallback((change: Partial<Prefs>) => {
    setPrefs((current) => {
      const next = { ...current, ...change };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  // A place that no longer exists (deleted elsewhere) falls back to My files.
  const live = useMemo<Loc>(() => {
    if (loc.kind === "folder" && !model.folderById.has(loc.id)) return { kind: "files", id: null };
    if (loc.kind === "collection" && !model.folderById.has(loc.id)) return { kind: "collections", id: null };
    if (loc.kind === "delivery" && !model.deliveryById.has(loc.id)) return { kind: "deliveries", id: null };
    return loc;
  }, [loc, model]);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("at", locKey(live));
    window.history.replaceState(window.history.state, "", url);
  }, [live]);

  const items = useMemo(
    () => sortItems(itemsAt(model, data, live, query), prefs.sort, prefs.dir),
    [model, data, live, query, prefs.sort, prefs.dir],
  );
  const groups = useMemo(() => groupItems(items, prefs.group && prefs.sort === "date"), [items, prefs.group, prefs.sort]);
  const ordered = useMemo(() => groups.flatMap((group) => (collapsed.has(group.key) ? [] : group.items)), [groups, collapsed]);
  const byKey = useMemo(() => new Map(items.map((item) => [item.key, item])), [items]);
  const chosen = useMemo(() => items.filter((item) => selected.has(item.key)), [items, selected]);

  const notify = useCallback((text: string, tone: "ok" | "error" = "ok") => {
    setToast({ id: Date.now(), text, tone });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const run = useCallback(
    (work: () => Promise<{ ok: boolean; error?: string }>, success?: string) => {
      startBusy(async () => {
        const result = await work();
        if (!result.ok) notify(result.error ?? "That did not work. Try again.", "error");
        else if (success) notify(success);
      });
    },
    [notify],
  );

  // ---------- Navigation ----------

  const go = useCallback(
    (next: Loc) => {
      if (locKey(next) === locKey(live)) return;
      setBack((stack) => [...stack.slice(-49), live]);
      setForward([]);
      setLoc(next);
      setQuery("");
      setSelected(new Set());
      setFocus(null);
      setAnchor(null);
      setRenaming(null);
      setTreeOpen(false);
      setSheet(false);
      content.current?.scrollTo({ top: 0 });
    },
    [live],
  );

  const goBack = () => {
    const previous = back.at(-1);
    if (!previous) return;
    setBack((stack) => stack.slice(0, -1));
    setForward((stack) => [live, ...stack]);
    setLoc(previous);
    setSelected(new Set());
    setQuery("");
  };
  const goForward = () => {
    const next = forward[0];
    if (!next) return;
    setForward((stack) => stack.slice(1));
    setBack((stack) => [...stack, live]);
    setLoc(next);
    setSelected(new Set());
    setQuery("");
  };

  const parentOf = (at: Loc): Loc | null => {
    if (at.kind === "folder") {
      const parent = model.folderById.get(at.id)?.parentId;
      return parent ? { kind: "folder", id: parent } : { kind: "files", id: null };
    }
    if (at.kind === "collection") return { kind: "collections", id: null };
    if (at.kind === "delivery") return { kind: "deliveries", id: null };
    return null;
  };
  const up = parentOf(live);

  const open = (item: Item) => {
    if (item.type === "folder") go({ kind: "folder", id: item.id });
    else if (item.type === "collection") go({ kind: "collection", id: item.id });
    else if (item.type === "delivery") go({ kind: "delivery", id: item.id });
    else {
      setSelected(new Set([item.key]));
      setFocus(item.key);
      setSheet(true);
      if (!prefs.preview) savePrefs({ preview: true });
    }
  };

  // ---------- Where am I ----------

  const crumbs: { label: string; loc: Loc; drop?: UploadTarget }[] = useMemo(() => {
    switch (live.kind) {
      case "files":
        return [{ label: "My files", loc: live, drop: { folderId: null } }];
      case "folder":
        return [
          { label: "My files", loc: { kind: "files", id: null }, drop: { folderId: null } },
          ...model.pathOf(live.id).map((folder) => ({
            label: folder.name,
            loc: { kind: "folder", id: folder.id } as Loc,
            drop: { folderId: folder.id },
          })),
        ];
      case "recent":
        return [{ label: "Recent", loc: live }];
      case "starred":
        return [{ label: "Starred", loc: live }];
      case "collections":
        return [{ label: "Collections", loc: live }];
      case "collection":
        return [
          { label: "Collections", loc: { kind: "collections", id: null } },
          { label: model.folderById.get(live.id)?.name ?? "Collection", loc: live },
        ];
      case "deliveries":
        return [{ label: "Deliveries", loc: live }];
      case "delivery":
        return [
          { label: "Deliveries", loc: { kind: "deliveries", id: null } },
          { label: model.deliveryById.get(live.id)?.title ?? "Delivery", loc: live },
        ];
    }
  }, [live, model]);
  const here = crumbs.at(-1)?.label ?? "My files";

  // Where an upload or a new folder goes from here. Places without a folder of their own put files at the top of My files.
  const uploadTarget: UploadTarget | null = useMemo(() => {
    if (live.kind === "folder") return { folderId: live.id };
    if (live.kind === "collection") return { folderId: null, collectionId: live.id };
    if (live.kind === "deliveries" || live.kind === "delivery") return null;
    return { folderId: null };
  }, [live]);
  const canMakeFolder = live.kind === "files" || live.kind === "folder";
  const readOnly = live.kind === "deliveries" || live.kind === "delivery";

  // ---------- Selection ----------

  const select = (item: Item, event: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) => {
    if (event.shiftKey && anchor) {
      const from = ordered.findIndex((entry) => entry.key === anchor);
      const to = ordered.findIndex((entry) => entry.key === item.key);
      if (from >= 0 && to >= 0) {
        const range = ordered.slice(Math.min(from, to), Math.max(from, to) + 1).map((entry) => entry.key);
        setSelected(new Set(event.metaKey || event.ctrlKey ? [...selected, ...range] : range));
        setFocus(item.key);
        return;
      }
    }
    if (event.metaKey || event.ctrlKey) {
      const next = new Set(selected);
      if (next.has(item.key)) next.delete(item.key);
      else next.add(item.key);
      setSelected(next);
    } else {
      setSelected(new Set([item.key]));
    }
    setFocus(item.key);
    setAnchor(item.key);
  };

  const toggle = (item: Item) => {
    const next = new Set(selected);
    if (next.has(item.key)) next.delete(item.key);
    else next.add(item.key);
    setSelected(next);
    setFocus(item.key);
    setAnchor(item.key);
  };

  const selectionOf = (list: Item[]) => ({
    fileIds: list.filter((item) => item.type === "file" && item.file.source === "library").map((item) => item.id),
    folderIds: list.filter((item) => item.type === "folder" || item.type === "collection").map((item) => item.id),
  });

  // ---------- Actions ----------

  const newFolder = (kind: "folder" | "collection") => {
    setMenu(null);
    const parent = kind === "folder" && live.kind === "folder" ? live.id : null;
    setDialog({
      kind: "name",
      title: kind === "folder" ? "New folder" : "New collection",
      label: kind === "folder" ? "Folder name" : "Collection name",
      initial: kind === "folder" ? "New folder" : "New collection",
      confirm: "Create",
      submit: async (name) => {
        const result = await createFolder(parent, name, kind);
        if (!result.ok) return result.error;
        if (kind === "collection" && live.kind !== "collections") go({ kind: "collections", id: null });
        setSelected(new Set([`${kind}:${result.id}`]));
        setFocus(`${kind}:${result.id}`);
        return null;
      },
    });
  };

  const startRename = (item: Item | undefined) => {
    setMenu(null);
    if (!item || item.type === "delivery" || (item.type === "file" && item.file.source !== "library")) return;
    setRenaming(item.key);
  };

  const finishRename = (item: Item, value: string) => {
    setRenaming(null);
    const name = value.trim();
    if (!name || name === item.name) return;
    run(() => renameItem(item.type === "file" ? "file" : "folder", item.id, name));
  };

  const starItems = (list: Item[]) => {
    setMenu(null);
    const target = selectionOf(list);
    if (!target.fileIds.length && !target.folderIds.length) return;
    const on = !list.every((item) => item.starred);
    run(() => setStarred(target, on), on ? "Starred" : "Removed from Starred");
  };

  const removeItems = (list: Item[]) => {
    setMenu(null);
    const target = selectionOf(list);
    if (!target.fileIds.length && !target.folderIds.length) return;
    const folders = list.filter((item) => item.type === "folder");
    const collections = list.filter((item) => item.type === "collection");
    const inside = folders.reduce((sum, item) => sum + model.deepFiles(item.id).length, 0);
    const body = [
      list.length === 1 ? `“${list[0].name}” will be deleted for good.` : `${list.length} items will be deleted for good.`,
      inside ? `That includes ${plural(inside, "file")} inside ${folders.length === 1 ? "the folder" : "those folders"}.` : "",
      collections.length ? "Deleting a collection keeps its files." : "",
      "Deliveries you already sent keep their own copies.",
    ]
      .filter(Boolean)
      .join(" ");
    setDialog({
      kind: "confirm",
      title:
        list.length === 1 ? `Delete ${list[0].type === "file" ? "this file" : `this ${list[0].type}`}?` : `Delete ${list.length} items?`,
      body,
      confirm: "Delete",
      submit: async () => {
        const result = await deleteItems(target);
        if (!result.ok) return result.error;
        setSelected(new Set());
        notify(list.length === 1 ? "Deleted" : `Deleted ${list.length} items`);
        return null;
      },
    });
  };

  const moveTo = (list: Item[]) => {
    setMenu(null);
    const target = selectionOf(list.filter((item) => item.type !== "collection"));
    if (!target.fileIds.length && !target.folderIds.length) return;
    setDialog({
      kind: "move",
      title: list.length === 1 ? `Move “${list[0].name}”` : `Move ${list.length} items`,
      confirm: "Move here",
      exclude: new Set(target.folderIds),
      submit: async (folderId) => {
        const result = await moveItems(target, folderId);
        if (!result.ok) return result.error;
        notify(`Moved to ${folderId ? model.folderById.get(folderId)?.name : "My files"}`);
        return null;
      },
    });
  };

  const copyIn = (list: Item[]) => {
    setMenu(null);
    const ids = list.filter((item) => item.type === "file" && item.file.source === "delivery").map((item) => item.id);
    if (!ids.length) return;
    setDialog({
      kind: "move",
      title: ids.length === 1 ? "Copy to My files" : `Copy ${ids.length} files to My files`,
      confirm: "Copy here",
      exclude: new Set(),
      submit: async (folderId) => {
        const result = await copyToLibrary(ids, folderId);
        if (!result.ok) return result.error;
        notify(`Copied ${plural(ids.length, "file")} to ${folderId ? model.folderById.get(folderId)?.name : "My files"}`);
        return null;
      },
    });
  };

  const collect = (collectionId: string, list: Item[]) => {
    setMenu(null);
    const ids = list.flatMap((item) =>
      item.type === "file" && item.file.source === "library"
        ? [item.id]
        : item.type === "folder"
          ? model.deepFiles(item.id).map((file) => file.id)
          : [],
    );
    if (!ids.length) return notify("Only your own files can go in a collection. Copy delivery files to My files first.", "error");
    run(() => addToCollection(collectionId, ids), `Added to ${model.folderById.get(collectionId)?.name}`);
  };

  const uncollect = (list: Item[]) => {
    setMenu(null);
    if (live.kind !== "collection") return;
    const ids = list.filter((item) => item.type === "file").map((item) => item.id);
    run(() => removeFromCollection(live.id, ids), "Removed from the collection");
  };

  // Turns a folder, a collection or a selection into a draft delivery. A folder's subfolders become its sections.
  const plan = (list: Item[]): SendInput | null => {
    if (list.length === 1 && list[0].type === "folder") {
      const folder = list[0].folder;
      const sections = [
        { title: "Final files", fileIds: (model.filesIn.get(folder.id) ?? []).map((file) => file.id) },
        ...(model.subfolders.get(folder.id) ?? []).map((child) => ({
          title: child.name,
          fileIds: model.deepFiles(child.id).map((file) => file.id),
        })),
      ].filter((section) => section.fileIds.length);
      return { title: folder.name, sections };
    }
    if (list.length === 1 && list[0].type === "collection") {
      return {
        title: list[0].name,
        sections: [{ title: "Final files", fileIds: (model.collectionFiles.get(list[0].id) ?? []).map((file) => file.id) }],
      };
    }
    const fileIds = list.flatMap((item) =>
      item.type === "file" && item.file.source === "library"
        ? [item.id]
        : item.type === "folder"
          ? model.deepFiles(item.id).map((file) => file.id)
          : item.type === "collection"
            ? (model.collectionFiles.get(item.id) ?? []).map((file) => file.id)
            : [],
    );
    return { title: here, sections: [{ title: "Final files", fileIds: [...new Set(fileIds)] }] };
  };

  const sendItems = (list: Item[]) => {
    setMenu(null);
    let source = list;
    if (!source.length) {
      if (live.kind === "folder") source = [model.folderItem(model.folderById.get(live.id) as ExFolder)];
      else if (live.kind === "collection") source = [model.folderItem(model.folderById.get(live.id) as ExFolder)];
      else source = items.filter((item) => item.type === "file" && item.file.source === "library");
    }
    const input = plan(source);
    const count = input ? new Set(input.sections.flatMap((section) => section.fileIds)).size : 0;
    if (!input || !count) return notify("Pick some of your files first. There is nothing here to send yet.", "error");
    setDialog({
      kind: "name",
      title: `Send ${plural(count, "file")} as a delivery`,
      label: "Delivery name",
      initial: input.title,
      confirm: "Make delivery",
      submit: async (title) => {
        const result = await sendAsDelivery({ ...input, title });
        if (!result.ok) return result.error;
        router.push(`/deliveries/${result.id}?created=1`);
        return null;
      },
    });
  };

  const download = (list: Item[]) => {
    setMenu(null);
    const files = list.filter((item) => item.type === "file").map((item) => item.file);
    // Each download is its own link; browsers allow a handful in a row from one click.
    files.slice(0, 20).forEach((file, index) => {
      window.setTimeout(() => {
        const link = document.createElement("a");
        link.href = fileHref(file);
        link.rel = "noopener";
        document.body.appendChild(link);
        link.click();
        link.remove();
      }, index * 350);
    });
    if (files.length > 20) notify("The first 20 files are downloading. Send the rest as a delivery to get them all at once.");
  };

  const upload = (files: File[], target: UploadTarget | null = uploadTarget) => {
    if (!files.length) return;
    if (!data.storageReady) return notify("File storage is not connected yet.", "error");
    if (!target) return notify("Deliveries are read-only here. Drop files into My files or a folder.", "error");
    uploads.start(files, target);
  };

  // ---------- Drag and drop ----------

  const dragStart = (item: Item, event: React.DragEvent) => {
    const keys = selected.has(item.key) ? [...selected] : [item.key];
    if (!selected.has(item.key)) {
      setSelected(new Set([item.key]));
      setFocus(item.key);
    }
    event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(keys));
    event.dataTransfer.effectAllowed = "copyMove";
  };

  type DropTarget = { kind: "folder"; id: string | null } | { kind: "collection"; id: string };

  const accepts = (event: React.DragEvent) => event.dataTransfer.types.includes(DRAG_TYPE) || event.dataTransfer.types.includes("Files");

  const dropOn = (target: DropTarget, event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDropKey(null);
    if (event.dataTransfer.files.length && !event.dataTransfer.types.includes(DRAG_TYPE)) {
      upload(
        Array.from(event.dataTransfer.files),
        target.kind === "folder" ? { folderId: target.id } : { folderId: null, collectionId: target.id },
      );
      return;
    }
    let keys: string[] = [];
    try {
      keys = JSON.parse(event.dataTransfer.getData(DRAG_TYPE));
    } catch {
      return;
    }
    const list = keys.map((key) => byKey.get(key)).filter((item): item is Item => Boolean(item));
    if (target.kind === "collection") return collect(target.id, list);
    const sent = list.filter((item) => item.type === "file" && item.file.source === "delivery");
    if (sent.length) {
      const ids = sent.map((item) => item.id);
      run(
        () => copyToLibrary(ids, target.id),
        `Copied ${plural(ids.length, "file")} to ${target.id ? model.folderById.get(target.id)?.name : "My files"}`,
      );
    }
    const own = selectionOf(list.filter((item) => item.type !== "collection" && item.key !== `folder:${target.id}`));
    if (own.fileIds.length || own.folderIds.length) {
      run(() => moveItems(own, target.id), `Moved to ${target.id ? model.folderById.get(target.id)?.name : "My files"}`);
    }
  };

  const dropProps = (key: string, target: DropTarget) => ({
    onDragOver: (event: React.DragEvent) => {
      if (!accepts(event)) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = event.dataTransfer.types.includes("Files") || target.kind === "collection" ? "copy" : "move";
      if (dropKey !== key) setDropKey(key);
    },
    onDragLeave: (event: React.DragEvent) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropKey((current) => (current === key ? null : current));
    },
    onDrop: (event: React.DragEvent) => dropOn(target, event),
    "data-drop": dropKey === key ? "true" : undefined,
  });

  const itemDrop = (item: Item) =>
    item.type === "folder"
      ? dropProps(item.key, { kind: "folder", id: item.id })
      : item.type === "collection"
        ? dropProps(item.key, { kind: "collection", id: item.id })
        : {};

  // ---------- Rubber-band selection ----------

  const bandStart = useRef<{ x: number; y: number; base: Set<string> } | null>(null);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.pointerType !== "mouse") return;
    if ((event.target as HTMLElement).closest("[data-key], button, input, a, [data-group-head]")) return;
    const box = event.currentTarget.getBoundingClientRect();
    const scroller = event.currentTarget;
    bandStart.current = {
      x: event.clientX - box.left + scroller.scrollLeft,
      y: event.clientY - box.top + scroller.scrollTop,
      base: event.metaKey || event.ctrlKey || event.shiftKey ? new Set(selected) : new Set(),
    };
    if (!event.metaKey && !event.ctrlKey && !event.shiftKey) {
      setSelected(new Set());
      setFocus(null);
    }
    scroller.setPointerCapture(event.pointerId);
    scroller.focus({ preventScroll: true });
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = bandStart.current;
    if (!start) return;
    const scroller = event.currentTarget;
    const box = scroller.getBoundingClientRect();
    const x = event.clientX - box.left + scroller.scrollLeft;
    const y = event.clientY - box.top + scroller.scrollTop;
    const rect = { x: Math.min(start.x, x), y: Math.min(start.y, y), w: Math.abs(x - start.x), h: Math.abs(y - start.y) };
    if (rect.w < 4 && rect.h < 4) return;
    setBand(rect);
    const next = new Set(start.base);
    scroller.querySelectorAll<HTMLElement>("[data-key]").forEach((node) => {
      const r = node.getBoundingClientRect();
      const left = r.left - box.left + scroller.scrollLeft;
      const top = r.top - box.top + scroller.scrollTop;
      if (left < rect.x + rect.w && left + r.width > rect.x && top < rect.y + rect.h && top + r.height > rect.y) {
        next.add(node.dataset.key as string);
      }
    });
    setSelected(next);
  };

  const onPointerUp = () => {
    bandStart.current = null;
    setBand(null);
  };

  // ---------- Keyboard ----------

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (renaming || dialog || (event.target as HTMLElement).tagName === "INPUT") return;
    const mod = event.metaKey || event.ctrlKey;
    if (mod && event.key.toLowerCase() === "a") {
      event.preventDefault();
      setSelected(new Set(ordered.map((item) => item.key)));
      return;
    }
    if (event.key === "Escape") {
      setSelected(new Set());
      setMenu(null);
      return;
    }
    if (event.key === "Delete" || (event.key === "Backspace" && mod)) {
      if (chosen.length && !readOnly) removeItems(chosen);
      return;
    }
    if (event.key === "F2") {
      event.preventDefault();
      startRename(focus ? byKey.get(focus) : chosen[0]);
      return;
    }
    if (event.key === "Enter") {
      const item = focus ? byKey.get(focus) : chosen[0];
      if (item) open(item);
      return;
    }
    if ((event.key === "Backspace" || (event.altKey && event.key === "ArrowUp")) && up) {
      event.preventDefault();
      go(up);
      return;
    }
    if (event.key.startsWith("Arrow") && ordered.length) {
      event.preventDefault();
      const index = Math.max(
        0,
        ordered.findIndex((item) => item.key === focus),
      );
      let step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        let columns = 1;
        if (prefs.view !== "list" && content.current) {
          const nodes = [...content.current.querySelectorAll<HTMLElement>("[data-key]")];
          const top = nodes[0]?.offsetTop;
          columns = Math.max(1, nodes.filter((node) => node.offsetTop === top).length);
        }
        step = event.key === "ArrowDown" ? columns : -columns;
      }
      const next = ordered[Math.min(ordered.length - 1, Math.max(0, focus ? index + step : 0))];
      select(next, { shiftKey: event.shiftKey, metaKey: false, ctrlKey: false });
      content.current?.querySelector<HTMLElement>(`[data-key="${next.key}"]`)?.scrollIntoView({ block: "nearest" });
    }
  };

  // ---------- Context menu ----------

  const openMenu = (event: React.MouseEvent, item: Item | null) => {
    event.preventDefault();
    event.stopPropagation();
    let keys: string[] = [];
    if (item) {
      keys = selected.has(item.key) ? [...selected] : [item.key];
      if (!selected.has(item.key)) {
        setSelected(new Set([item.key]));
        setFocus(item.key);
      }
    }
    const x = Math.min(event.clientX, window.innerWidth - 260);
    const y = Math.min(event.clientY, window.innerHeight - 360);
    setMenu({ x, y, keys });
  };

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menu]);

  // ---------- What the toolbar can do right now ----------

  const own = chosen.filter(
    (item) => (item.type === "file" && item.file.source === "library") || item.type === "folder" || item.type === "collection",
  );
  const sentFiles = chosen.filter((item) => item.type === "file" && item.file.source === "delivery");
  const filesChosen = chosen.filter((item) => item.type === "file");
  const one = chosen.length === 1 ? chosen[0] : null;
  const canRename = Boolean(one && own.length === 1);
  const canMove = own.some((item) => item.type !== "collection");
  const focusItem = (focus && byKey.get(focus)) || one || null;

  const totalSize = chosen.reduce((sum, item) => sum + item.size, 0);
  const usedShare = Math.min(1, data.usedBytes / data.limitBytes);

  // ---------- Render ----------

  const renderName = (item: Item, className: string) =>
    renaming === item.key ? (
      <input
        className={styles.renameInput}
        defaultValue={item.name}
        autoFocus
        aria-label="New name"
        onFocus={(event) => {
          const dot = item.type === "file" ? event.currentTarget.value.lastIndexOf(".") : -1;
          event.currentTarget.setSelectionRange(0, dot > 0 ? dot : event.currentTarget.value.length);
        }}
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Enter") finishRename(item, event.currentTarget.value);
          if (event.key === "Escape") setRenaming(null);
        }}
        onBlur={(event) => finishRename(item, event.currentTarget.value)}
      />
    ) : (
      <span className={className} title={item.name}>
        {item.name}
      </span>
    );

  const itemProps = (item: Item, index: number) => ({
    "data-key": item.key,
    "aria-selected": selected.has(item.key),
    "data-focus": focus === item.key ? "true" : undefined,
    "data-starred": item.starred ? "true" : undefined,
    role: "option" as const,
    style: { "--i": Math.min(index, 24) } as React.CSSProperties,
    draggable: renaming !== item.key,
    onDragStart: (event: React.DragEvent) => dragStart(item, event),
    onClick: (event: React.MouseEvent) => {
      if (selected.size > 0 && window.matchMedia("(hover: none)").matches) return toggle(item);
      if (window.matchMedia("(hover: none)").matches) return open(item);
      select(item, event);
    },
    onDoubleClick: () => open(item),
    onContextMenu: (event: React.MouseEvent) => openMenu(event, item),
    ...longPress(item),
    ...itemDrop(item),
  });

  // On a phone, a long press starts selecting instead of opening.
  const pressTimer = useRef<number | null>(null);
  function longPress(item: Item) {
    return {
      onTouchStart: () => {
        pressTimer.current = window.setTimeout(() => {
          pressTimer.current = null;
          toggle(item);
          navigator.vibrate?.(12);
        }, 450);
      },
      onTouchEnd: (event: React.TouchEvent) => {
        if (pressTimer.current) window.clearTimeout(pressTimer.current);
        else event.preventDefault();
        pressTimer.current = null;
      },
      onTouchMove: () => {
        if (pressTimer.current) window.clearTimeout(pressTimer.current);
        pressTimer.current = null;
      },
    };
  }

  const Check = ({ item }: { item: Item }) => (
    <button
      type="button"
      className={styles.check}
      aria-label={selected.has(item.key) ? `Unselect ${item.name}` : `Select ${item.name}`}
      onClick={(event) => {
        event.stopPropagation();
        toggle(item);
      }}
      onDoubleClick={(event) => event.stopPropagation()}
      tabIndex={-1}
    >
      <ExIcon name="check" size={13} />
    </button>
  );

  const emptyText = query
    ? `Nothing called “${query}” in ${here}.`
    : live.kind === "recent"
      ? "Files you add show up here for 30 days."
      : live.kind === "starred"
        ? "Star a file or folder to keep it here."
        : live.kind === "collections"
          ? "Collections group files from anywhere without moving them. Make one for a client, a shoot or your portfolio."
          : live.kind === "collection"
            ? "Drag files here, or right-click a file and pick Add to collection."
            : live.kind === "deliveries"
              ? "Every delivery you make shows up here as a folder."
              : live.kind === "delivery"
                ? "This delivery has no files yet."
                : "Drop files anywhere here, or make a folder to start.";

  return (
    <div
      className={styles.window}
      data-wide
      data-busy={busy ? "true" : undefined}
      data-preview={prefs.preview ? "true" : undefined}
      data-tree={treeOpen ? "open" : undefined}
    >
      <div className={styles.progress} aria-hidden="true" />

      {/* ---------- Address row ---------- */}
      <div className={styles.addressRow}>
        <div className={styles.navButtons}>
          <button
            type="button"
            className={`${styles.iconButton} ${styles.treeButton}`}
            onClick={() => setTreeOpen(true)}
            aria-label="Show places"
          >
            <ExIcon name="menu" />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={goBack}
            disabled={!back.length}
            aria-label="Back"
            title="Back (Alt+Left)"
          >
            <ExIcon name="back" />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={goForward}
            disabled={!forward.length}
            aria-label="Forward"
            title="Forward"
          >
            <ExIcon name="forward" />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => up && go(up)}
            disabled={!up}
            aria-label="Up one level"
            title="Up (Backspace)"
          >
            <ExIcon name="up" />
          </button>
          <button
            type="button"
            className={`${styles.iconButton} ${styles.hideSmall}`}
            onClick={() => startBusy(() => router.refresh())}
            aria-label="Refresh"
            title="Refresh"
          >
            <ExIcon name="refresh" />
          </button>
        </div>

        <nav className={styles.crumbs} aria-label="Location">
          <span className={styles.crumbIcon} aria-hidden="true">
            <ExIcon name="drive" />
          </span>
          <ol>
            {crumbs.map((crumb, index) => (
              <li key={locKey(crumb.loc)}>
                <ExIcon name="chevron" size={14} />
                <button
                  type="button"
                  className={styles.crumb}
                  aria-current={index === crumbs.length - 1 ? "location" : undefined}
                  onClick={() => go(crumb.loc)}
                  {...(crumb.drop ? dropProps(`crumb:${locKey(crumb.loc)}`, { kind: "folder", id: crumb.drop.folderId }) : {})}
                >
                  {crumb.label}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <label className={styles.search}>
          <ExIcon name="search" size={16} />
          <input
            type="search"
            value={query}
            placeholder={`Search ${here}`}
            onChange={(event) => {
              setQuery(event.currentTarget.value);
              setSelected(new Set());
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") setQuery("");
            }}
          />
        </label>
      </div>

      {/* ---------- Toolbar ---------- */}
      <div className={styles.toolbar} role="toolbar" aria-label="File actions">
        <div className={styles.toolGroup}>
          <Dropdown
            label="New"
            icon="plus"
            primary
            items={[
              {
                label: "Folder",
                icon: "folderPlus",
                disabled: !canMakeFolder,
                onSelect: () => newFolder("folder"),
                hint: canMakeFolder ? undefined : "Open My files",
              },
              { label: "Collection", icon: "collection", onSelect: () => newFolder("collection") },
              { label: "Upload files", icon: "upload", disabled: !uploadTarget, onSelect: () => uploadInput.current?.click() },
            ]}
          />
          <button
            type="button"
            className={styles.tool}
            onClick={() => uploadInput.current?.click()}
            disabled={!uploadTarget || !data.storageReady}
          >
            <ExIcon name="upload" />
            <span>Upload</span>
          </button>
          <input
            ref={uploadInput}
            type="file"
            multiple
            hidden
            onChange={(event) => {
              upload(Array.from(event.currentTarget.files ?? []));
              event.currentTarget.value = "";
            }}
          />
        </div>

        <span className={styles.toolDivider} />

        <div className={styles.toolGroup}>
          {sentFiles.length > 0 ? (
            <>
              <ToolButton icon="download" label="Download" onClick={() => download(sentFiles)} />
              <ToolButton icon="copy" label="Copy to My files" onClick={() => copyIn(sentFiles)} />
            </>
          ) : (
            <>
              <ToolButton icon="rename" label="Rename" iconOnly onClick={() => startRename(one ?? undefined)} disabled={!canRename} />
              <ToolButton icon="move" label="Move" iconOnly onClick={() => moveTo(own)} disabled={!canMove} />
              <ToolButton
                icon="star"
                label={own.length && own.every((item) => item.starred) ? "Unstar" : "Star"}
                iconOnly
                onClick={() => starItems(own)}
                disabled={!own.length}
                active={own.length > 0 && own.every((item) => item.starred)}
              />
              <ToolButton icon="download" label="Download" iconOnly onClick={() => download(filesChosen)} disabled={!filesChosen.length} />
              {live.kind === "collection" ? (
                <ToolButton
                  icon="remove"
                  label="Remove from collection"
                  iconOnly
                  onClick={() => uncollect(chosen)}
                  disabled={!filesChosen.length}
                />
              ) : null}
              <ToolButton icon="trash" label="Delete" iconOnly onClick={() => removeItems(own)} disabled={!own.length} danger />
            </>
          )}
        </div>

        <span className={styles.toolDivider} />

        <div className={styles.toolGroup}>
          <Dropdown
            label="Sort"
            icon="sort"
            items={[
              ...(["name", "date", "size", "type"] as SortKey[]).map((key) => ({
                label: { name: "Name", date: "Date added", size: "Size", type: "Type" }[key],
                checked: prefs.sort === key,
                onSelect: () => savePrefs({ sort: key, dir: key === "date" || key === "size" ? -1 : 1 }),
              })),
              { separator: true },
              { label: "Ascending", checked: prefs.dir === 1, onSelect: () => savePrefs({ dir: 1 }) },
              { label: "Descending", checked: prefs.dir === -1, onSelect: () => savePrefs({ dir: -1 }) },
            ]}
          />
          <Dropdown
            label="View"
            icon={prefs.view === "list" ? "list" : "grid"}
            items={[
              { label: "Large tiles", icon: "grid", checked: prefs.view === "tiles", onSelect: () => savePrefs({ view: "tiles" }) },
              { label: "Tiles", icon: "grid", checked: prefs.view === "grid", onSelect: () => savePrefs({ view: "grid" }) },
              { label: "Details", icon: "list", checked: prefs.view === "list", onSelect: () => savePrefs({ view: "list" }) },
              { separator: true },
              {
                label: "Group by date",
                checked: prefs.group,
                disabled: prefs.sort !== "date",
                onSelect: () => savePrefs({ group: !prefs.group }),
              },
              { label: "Preview pane", checked: prefs.preview, onSelect: () => savePrefs({ preview: !prefs.preview }) },
            ]}
          />
        </div>

        <div className={styles.toolEnd}>
          {(live.kind === "delivery" || one?.type === "delivery") && (
            <Link href={`/deliveries/${live.kind === "delivery" ? live.id : one?.id}`} className={styles.tool}>
              <ExIcon name="open" />
              <span>Open delivery</span>
            </Link>
          )}
          {!readOnly && (
            <button type="button" className={styles.sendButton} onClick={() => sendItems(own)}>
              <ExIcon name="send" />
              <span>Send as delivery</span>
            </button>
          )}
          <button
            type="button"
            className={`${styles.iconButton} ${styles.hideSmall}`}
            aria-pressed={prefs.preview}
            onClick={() => savePrefs({ preview: !prefs.preview })}
            title="Preview pane"
            aria-label="Preview pane"
          >
            <ExIcon name="panel" />
          </button>
        </div>
      </div>

      {/* ---------- Panes ---------- */}
      <div className={styles.panes}>
        <div className={styles.treeScrim} onClick={() => setTreeOpen(false)} aria-hidden="true" />
        <aside className={styles.tree} aria-label="Places">
          <div className={styles.treeHead}>
            <span>Memo Explorer</span>
            <button
              type="button"
              className={`${styles.iconButton} ${styles.treeClose}`}
              onClick={() => setTreeOpen(false)}
              aria-label="Close places"
            >
              <ExIcon name="close" />
            </button>
          </div>
          <ul className={styles.treeList} role="tree">
            <TreeRow
              icon="clock"
              label="Recent"
              active={live.kind === "recent"}
              onOpen={() => go({ kind: "recent", id: null })}
              depth={0}
            />
            <TreeRow
              icon="star"
              label="Starred"
              active={live.kind === "starred"}
              onOpen={() => go({ kind: "starred", id: null })}
              depth={0}
              tone="amber"
            />
          </ul>

          <p className={styles.treeLabel}>Library</p>
          <ul className={styles.treeList} role="tree">
            <FolderBranch
              model={model}
              folder={null}
              depth={0}
              live={live}
              prefs={prefs}
              savePrefs={savePrefs}
              go={go}
              dropProps={dropProps}
              onMenu={(event, folder) => folder && openMenu(event, model.folderItem(folder))}
            />
            <TreeRow
              icon="collection"
              label="Collections"
              tone="amber"
              depth={0}
              active={live.kind === "collections"}
              onOpen={() => go({ kind: "collections", id: null })}
              expandable={model.collections.length > 0}
              expanded={prefs.open.includes("collections")}
              onToggle={() => savePrefs({ open: toggleOpen(prefs.open, "collections") })}
            />
            {prefs.open.includes("collections") &&
              model.collections.map((collection) => (
                <TreeRow
                  key={collection.id}
                  icon="collection"
                  label={collection.name}
                  depth={1}
                  tone="amber"
                  active={live.kind === "collection" && live.id === collection.id}
                  onOpen={() => go({ kind: "collection", id: collection.id })}
                  onMenu={(event) => openMenu(event, model.folderItem(collection))}
                  drop={dropProps(`tree:collection:${collection.id}`, { kind: "collection", id: collection.id })}
                />
              ))}
          </ul>

          <p className={styles.treeLabel}>Sent</p>
          <ul className={styles.treeList} role="tree">
            <TreeRow
              icon="delivery"
              label="Deliveries"
              depth={0}
              active={live.kind === "deliveries"}
              onOpen={() => go({ kind: "deliveries", id: null })}
              expandable={data.deliveries.length > 0}
              expanded={prefs.open.includes("deliveries")}
              onToggle={() => savePrefs({ open: toggleOpen(prefs.open, "deliveries") })}
            />
            {prefs.open.includes("deliveries") &&
              data.deliveries
                .slice(0, 60)
                .map((delivery) => (
                  <TreeRow
                    key={delivery.id}
                    icon="delivery"
                    label={delivery.title}
                    depth={1}
                    active={live.kind === "delivery" && live.id === delivery.id}
                    onOpen={() => go({ kind: "delivery", id: delivery.id })}
                    dot={delivery.state}
                  />
                ))}
          </ul>

          <div className={styles.storage}>
            <div className={styles.storageTop}>
              <span>Storage</span>
              <span>
                {formatSize(data.usedBytes)} of {formatSize(data.limitBytes)}
              </span>
            </div>
            <span className={styles.storageBar}>
              <span style={{ width: `${Math.max(usedShare * 100, data.usedBytes ? 1.5 : 0)}%` }} />
            </span>
          </div>
        </aside>

        <div
          ref={content}
          className={styles.content}
          data-view={prefs.view}
          tabIndex={0}
          role="listbox"
          aria-multiselectable="true"
          aria-label={here}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onContextMenu={(event) => openMenu(event, null)}
          onDragOver={(event) => {
            if (!event.dataTransfer.types.includes("Files") || !uploadTarget) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
            if (dropKey !== "content") setDropKey("content");
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null))
              setDropKey((current) => (current === "content" ? null : current));
          }}
          onDrop={(event) => {
            setDropKey(null);
            if (!event.dataTransfer.types.includes("Files") || event.dataTransfer.types.includes(DRAG_TYPE)) return;
            event.preventDefault();
            upload(Array.from(event.dataTransfer.files));
          }}
          data-drop={dropKey === "content" ? "true" : undefined}
        >
          {prefs.view === "list" && ordered.length > 0 && (
            <div className={styles.listHead} role="presentation">
              {(
                [
                  ["name", "Name"],
                  ["date", "Date added"],
                  ["type", "Type"],
                  ["size", "Size"],
                ] as [SortKey, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={styles.listHeadCell}
                  data-col={key}
                  aria-sort={prefs.sort === key ? (prefs.dir === 1 ? "ascending" : "descending") : undefined}
                  onClick={() =>
                    savePrefs(
                      prefs.sort === key
                        ? { dir: prefs.dir === 1 ? -1 : 1 }
                        : { sort: key, dir: key === "name" || key === "type" ? 1 : -1 },
                    )
                  }
                >
                  {label}
                  {prefs.sort === key && (
                    <span className={styles.sortArrow} data-dir={prefs.dir}>
                      <ExIcon name="chevronDown" size={13} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {groups.map((group) => (
            <section key={`${locKey(live)}:${group.key}`} className={styles.group}>
              {group.label && (
                <button
                  type="button"
                  data-group-head
                  className={styles.groupHead}
                  aria-expanded={!collapsed.has(group.key)}
                  onClick={() =>
                    setCollapsed((current) => {
                      const next = new Set(current);
                      if (next.has(group.key)) next.delete(group.key);
                      else next.add(group.key);
                      return next;
                    })
                  }
                >
                  <ExIcon name="chevronDown" size={14} />
                  <span>{group.label}</span>
                  <span className={styles.groupCount}>{group.items.length}</span>
                </button>
              )}
              {!collapsed.has(group.key) &&
                (prefs.view === "list" ? (
                  <div className={styles.rows}>
                    {group.items.map((item, index) => (
                      <div key={item.key} className={styles.row} {...itemProps(item, index)}>
                        <span className={styles.rowName}>
                          <Check item={item} />
                          <SmallGlyph item={item} />
                          {renderName(item, styles.rowLabel)}
                          {item.starred && (
                            <span className={styles.starMark} aria-label="Starred">
                              <ExIcon name="star" filled size={13} />
                            </span>
                          )}
                        </span>
                        <span className={styles.rowCell} data-col="date">
                          {fmtDate(item.date)}
                        </span>
                        <span className={styles.rowCell} data-col="type">
                          {item.type === "file" && item.file.ext ? `${describe(item)} · ${item.file.ext.toUpperCase()}` : describe(item)}
                        </span>
                        <span className={styles.rowCell} data-col="size">
                          {item.type === "file" ? formatSize(item.size) : plural(item.count, item.type === "folder" ? "item" : "file")}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.tiles}>
                    {group.items.map((item, index) => (
                      <div key={item.key} className={styles.tile} data-type={item.type} {...itemProps(item, index)}>
                        <Check item={item} />
                        <span className={styles.art}>
                          <ItemArt item={item} />
                        </span>
                        <span className={styles.tileText}>
                          {renderName(item, styles.tileName)}
                          <span className={styles.tileMeta}>
                            {item.starred && <ExIcon name="star" filled size={11} />}
                            {metaLine(item)}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
            </section>
          ))}

          {ordered.length === 0 && groups.length === 0 && (
            <div className={styles.empty}>
              <span className={styles.emptyArt}>
                {live.kind === "collections" || live.kind === "collection" ? (
                  <CollectionArt thumbs={[]} />
                ) : (
                  <FolderArt thumbs={[]} tone="folder" />
                )}
              </span>
              <p className={styles.emptyTitle}>
                {query ? "No matches" : live.kind === "files" ? "Your library is empty" : "Nothing here yet"}
              </p>
              <p className={styles.emptyText}>{emptyText}</p>
              {!query && uploadTarget && data.storageReady && (
                <div className={styles.emptyActions}>
                  <button type="button" className={styles.sendButton} onClick={() => uploadInput.current?.click()}>
                    <ExIcon name="upload" />
                    <span>Upload files</span>
                  </button>
                  {canMakeFolder && (
                    <button type="button" className={styles.tool} onClick={() => newFolder("folder")}>
                      <ExIcon name="folderPlus" />
                      <span>New folder</span>
                    </button>
                  )}
                  {live.kind === "collections" && (
                    <button type="button" className={styles.tool} onClick={() => newFolder("collection")}>
                      <ExIcon name="collection" />
                      <span>New collection</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {band && <span className={styles.band} style={{ left: band.x, top: band.y, width: band.w, height: band.h }} />}
          {dropKey === "content" && (
            <div className={styles.dropHint} aria-hidden="true">
              <ExIcon name="upload" size={22} />
              <span>Drop to upload to {here}</span>
            </div>
          )}
        </div>

        {prefs.preview && (
          <Preview
            model={model}
            item={chosen.length > 1 ? null : focusItem}
            chosen={chosen}
            totalSize={totalSize}
            sheet={sheet}
            onClose={() => {
              setSheet(false);
              if (window.matchMedia("(max-width: 899px)").matches) setSelected(new Set());
            }}
            onStar={() => starItems(chosen)}
            onSend={() => sendItems(own)}
            onDownload={() => download(filesChosen)}
            onCopy={() => copyIn(sentFiles)}
            onOpenCollection={(id) => go({ kind: "collection", id })}
            readOnly={readOnly}
          />
        )}
      </div>

      {/* ---------- Status bar ---------- */}
      <footer className={styles.status}>
        <span>{plural(items.length, "item")}</span>
        {chosen.length > 0 && (
          <>
            <span className={styles.statusDivider} />
            <span>
              {chosen.length} selected{totalSize ? ` · ${formatSize(totalSize)}` : ""}
            </span>
            <button type="button" className={styles.statusLink} onClick={() => setSelected(new Set())}>
              Clear
            </button>
          </>
        )}
        <span className={styles.statusEnd}>
          <span className={styles.hideSmall}>
            {formatSize(data.usedBytes)} of {formatSize(data.limitBytes)} used
          </span>
          <span className={styles.viewSwitch} role="group" aria-label="View">
            <button type="button" aria-pressed={prefs.view === "list"} onClick={() => savePrefs({ view: "list" })} aria-label="Details">
              <ExIcon name="list" size={15} />
            </button>
            <button type="button" aria-pressed={prefs.view !== "list"} onClick={() => savePrefs({ view: "tiles" })} aria-label="Tiles">
              <ExIcon name="grid" size={15} />
            </button>
          </span>
        </span>
      </footer>

      {/* ---------- Floating layers ---------- */}
      {menu && (
        <ContextMenu
          menu={menu}
          onClose={() => setMenu(null)}
          build={() =>
            menuEntries({
              list: menu.keys.map((key) => byKey.get(key)).filter((item): item is Item => Boolean(item)),
              live,
              model,
              canMakeFolder,
              uploadTarget,
              open,
              startRename,
              moveTo,
              starItems,
              removeItems,
              collect,
              uncollect,
              sendItems,
              download,
              copyIn,
              newFolder,
              pickUpload,
              refresh: () => startBusy(() => router.refresh()),
              selectAll: () => setSelected(new Set(ordered.map((item) => item.key))),
              openDelivery: (id) => router.push(`/deliveries/${id}`),
            })
          }
        />
      )}

      {uploads.jobs.length > 0 && <UploadPanel jobs={uploads.jobs} onCancel={uploads.cancel} onClear={uploads.clearFinished} />}

      {toast && (
        <div key={toast.id} className={styles.toast} data-tone={toast.tone} role={toast.tone === "error" ? "alert" : "status"}>
          {toast.tone === "ok" ? <ExIcon name="check" size={16} /> : null}
          <span>{toast.text}</span>
        </div>
      )}

      {dialog && <DialogView dialog={dialog} model={model} onClose={() => setDialog(null)} />}
    </div>
  );
}

const toggleOpen = (open: string[], key: string) => (open.includes(key) ? open.filter((entry) => entry !== key) : [...open, key]);

// ---------- Toolbar pieces ----------

function ToolButton({
  icon,
  label,
  onClick,
  disabled,
  iconOnly,
  danger,
  active,
}: {
  icon: ExIconName;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  iconOnly?: boolean;
  danger?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={iconOnly ? styles.iconTool : styles.tool}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={iconOnly ? label : undefined}
      data-danger={danger ? "true" : undefined}
      data-active={active ? "true" : undefined}
    >
      <ExIcon name={icon} filled={active} />
      {!iconOnly && <span>{label}</span>}
    </button>
  );
}

type DropdownItem =
  | { separator: true }
  | { label: string; icon?: ExIconName; checked?: boolean; disabled?: boolean; hint?: string; onSelect: () => void; separator?: undefined };

function Dropdown({ label, icon, items, primary }: { label: string; icon: ExIconName; items: DropdownItem[]; primary?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div className={styles.dropdown} ref={ref}>
      <button
        type="button"
        className={primary ? styles.newButton : styles.tool}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <ExIcon name={icon} />
        <span>{label}</span>
        <ExIcon name="chevronDown" size={13} />
      </button>
      {open && (
        <div className={styles.menu} role="menu" data-anchored="true">
          {items.map((item, index) =>
            item.separator ? (
              <span key={index} className={styles.menuSeparator} role="separator" />
            ) : (
              <button
                key={item.label}
                type="button"
                role={item.checked !== undefined ? "menuitemcheckbox" : "menuitem"}
                aria-checked={item.checked}
                className={styles.menuItem}
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                <span className={styles.menuIcon}>
                  {item.checked ? <ExIcon name="check" size={15} /> : item.icon ? <ExIcon name={item.icon} size={16} /> : null}
                </span>
                <span>{item.label}</span>
                {item.hint && <span className={styles.menuHint}>{item.hint}</span>}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Tree ----------

function TreeRow({
  icon,
  label,
  depth,
  active,
  onOpen,
  expandable,
  expanded,
  onToggle,
  tone,
  dot,
  drop,
  onMenu,
}: {
  icon: ExIconName;
  label: string;
  depth: number;
  active: boolean;
  onOpen: () => void;
  expandable?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  tone?: "amber" | "teal";
  dot?: string;
  drop?: Record<string, unknown>;
  onMenu?: (event: React.MouseEvent) => void;
}) {
  return (
    <li role="treeitem" aria-expanded={expandable ? Boolean(expanded) : undefined} aria-selected={active}>
      <div
        className={styles.treeRow}
        data-active={active ? "true" : undefined}
        style={{ "--depth": depth } as React.CSSProperties}
        {...drop}
      >
        {expandable ? (
          <button
            type="button"
            className={styles.twisty}
            aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
            onClick={onToggle}
            data-open={expanded ? "true" : undefined}
          >
            <ExIcon name="chevron" size={13} />
          </button>
        ) : (
          <span className={styles.twistySpace} />
        )}
        <button type="button" className={styles.treeLink} onClick={onOpen} onContextMenu={onMenu} title={label}>
          <span className={styles.treeIcon} data-tone={tone}>
            <ExIcon name={icon} filled={icon === "folder" || (icon === "star" && active)} size={17} />
          </span>
          <span className={styles.treeText}>{label}</span>
          {dot && <span className={styles.stateDot} data-state={dot} />}
        </button>
      </div>
    </li>
  );
}

function FolderBranch({
  model,
  folder,
  depth,
  live,
  prefs,
  savePrefs,
  go,
  dropProps,
  onMenu,
}: {
  model: Model;
  folder: ExFolder | null;
  depth: number;
  live: Loc;
  prefs: Prefs;
  savePrefs: (change: Partial<Prefs>) => void;
  go: (loc: Loc) => void;
  dropProps: (key: string, target: { kind: "folder"; id: string | null }) => Record<string, unknown>;
  onMenu: (event: React.MouseEvent, folder: ExFolder | null) => void;
}) {
  const key = folder ? folder.id : "files";
  const children = model.subfolders.get(folder ? folder.id : "root") ?? [];
  const expanded = prefs.open.includes(key);
  const active = folder ? live.kind === "folder" && live.id === folder.id : live.kind === "files";
  return (
    <>
      <TreeRow
        icon={folder ? "folder" : "drive"}
        label={folder ? folder.name : "My files"}
        depth={depth}
        tone="teal"
        active={active}
        onOpen={() => go(folder ? { kind: "folder", id: folder.id } : { kind: "files", id: null })}
        expandable={children.length > 0}
        expanded={expanded}
        onToggle={() => savePrefs({ open: toggleOpen(prefs.open, key) })}
        drop={dropProps(`tree:${key}`, { kind: "folder", id: folder ? folder.id : null })}
        onMenu={folder ? (event) => onMenu(event, folder) : undefined}
      />
      {expanded &&
        depth < 12 &&
        children.map((child) => (
          <FolderBranch
            key={child.id}
            model={model}
            folder={child}
            depth={depth + 1}
            live={live}
            prefs={prefs}
            savePrefs={savePrefs}
            go={go}
            dropProps={dropProps}
            onMenu={onMenu}
          />
        ))}
    </>
  );
}

// ---------- Preview pane ----------

function Preview({
  model,
  item,
  chosen,
  totalSize,
  sheet,
  onClose,
  onStar,
  onSend,
  onDownload,
  onCopy,
  onOpenCollection,
  readOnly,
}: {
  model: Model;
  item: Item | null;
  chosen: Item[];
  totalSize: number;
  sheet: boolean;
  onClose: () => void;
  onStar: () => void;
  onSend: () => void;
  onDownload: () => void;
  onCopy: () => void;
  onOpenCollection: (id: string) => void;
  readOnly: boolean;
}) {
  const [loaded, setLoaded] = useState<{ id: string; src: string } | null>(null);
  const file = item?.type === "file" ? item.file : null;
  const kind = file ? fileKind(file.mimeType, file.ext) : null;
  const fullSize =
    file && kind === "image" && /^image\/(jpeg|png|webp|gif|avif)$/.test(file.mimeType ?? "") && file.sizeBytes <= 40 * 1024 * 1024;
  const viewHref = file && fullSize ? fileHref(file, true) : null;
  const fileId = file?.id ?? null;
  const full = loaded && loaded.id === fileId ? loaded.src : null;

  // A picture shows its small preview at once, then the full-size copy once it has loaded.
  useEffect(() => {
    if (!viewHref || !fileId) return;
    const image = new Image();
    let alive = true;
    image.onload = () => alive && setLoaded({ id: fileId, src: image.src });
    image.src = viewHref;
    return () => {
      alive = false;
    };
  }, [viewHref, fileId]);

  if (chosen.length > 1) {
    const thumbs = chosen
      .flatMap((entry) =>
        entry.type === "file" && entry.file.thumb ? [entry.file.thumb] : entry.type !== "file" ? entry.thumbs.slice(0, 1) : [],
      )
      .slice(0, 3);
    return (
      <aside className={styles.preview} data-sheet={sheet ? "open" : undefined} aria-label="Selection">
        <div className={styles.previewStage} data-multi="true">
          {thumbs.length ? <CollectionArt thumbs={thumbs} /> : <FolderArt thumbs={[]} tone="folder" />}
        </div>
        <div className={styles.previewBody}>
          <h2 className={styles.previewTitle}>{chosen.length} items selected</h2>
          <p className={styles.previewSub}>{totalSize ? formatSize(totalSize) : "Folders and collections"}</p>
          {!readOnly && (
            <div className={styles.previewActions}>
              <button type="button" className={styles.sendButton} onClick={onSend}>
                <ExIcon name="send" />
                <span>Send as delivery</span>
              </button>
              <button type="button" className={styles.tool} onClick={onStar}>
                <ExIcon name="star" />
                <span>Star</span>
              </button>
            </div>
          )}
        </div>
      </aside>
    );
  }

  if (!item) {
    return (
      <aside className={styles.preview} aria-label="Preview">
        <div className={styles.previewEmpty}>
          <ExIcon name="panel" size={28} />
          <p>Select a file to see it here.</p>
          <p className={styles.previewHint}>Tip: drag files onto a folder to move them, or right-click for more.</p>
        </div>
      </aside>
    );
  }

  const where =
    file?.source === "library"
      ? ["My files", ...model.pathOf(file.folderId).map((folder) => folder.name)].join(" › ")
      : file?.deliveryId
        ? `Delivery › ${model.deliveryById.get(file.deliveryId)?.title ?? ""}`
        : item.type === "folder"
          ? ["My files", ...model.pathOf(item.folder.parentId).map((folder) => folder.name)].join(" › ")
          : item.type === "collection"
            ? "Collections"
            : "Deliveries";
  const inCollections = file ? (model.collectionsOf.get(file.id) ?? []) : [];

  return (
    <aside className={styles.preview} data-sheet={sheet ? "open" : undefined} aria-label={`Preview of ${item.name}`}>
      <button type="button" className={`${styles.iconButton} ${styles.sheetClose}`} onClick={onClose} aria-label="Close preview">
        <ExIcon name="close" />
      </button>
      <div className={styles.previewStage} data-kind={kind ?? item.type}>
        {file && kind === "video" ? (
          <video key={file.id} src={fileHref(file, true)} poster={file.thumb ?? undefined} controls playsInline preload="metadata" />
        ) : file && kind === "audio" ? (
          <div className={styles.audioStage}>
            <DocGlyph ext={file.ext} kind="audio" />
            <audio key={file.id} src={fileHref(file, true)} controls preload="none" />
          </div>
        ) : file && file.thumb ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- a signed storage link */}
            <img src={file.thumb} alt="" className={styles.previewGlow} aria-hidden="true" />
            {/* eslint-disable-next-line @next/next/no-img-element -- a signed storage link */}
            <img src={full ?? file.thumb} alt={item.name} className={styles.previewImage} data-full={full ? "true" : undefined} />
          </>
        ) : (
          <span className={styles.previewArt}>
            <ItemArt item={item} />
          </span>
        )}
      </div>
      <div className={styles.previewBody}>
        <h2 className={styles.previewTitle}>{item.name}</h2>
        <p className={styles.previewSub}>
          {describe(item)}
          {file?.ext ? ` · ${file.ext.toUpperCase()}` : ""}
          {item.size ? ` · ${formatSize(item.size)}` : ""}
        </p>
        <div className={styles.previewActions}>
          {file && (
            <a className={styles.tool} href={fileHref(file)} download onClick={(event) => (event.preventDefault(), onDownload())}>
              <ExIcon name="download" />
              <span>Download</span>
            </a>
          )}
          {file?.source === "delivery" && (
            <button type="button" className={styles.tool} onClick={onCopy}>
              <ExIcon name="copy" />
              <span>Copy to My files</span>
            </button>
          )}
          {item.type === "delivery" && (
            <Link className={styles.tool} href={`/deliveries/${item.id}`}>
              <ExIcon name="open" />
              <span>Open delivery</span>
            </Link>
          )}
          {item.type !== "delivery" && file?.source !== "delivery" && (
            <>
              <button
                type="button"
                className={styles.iconTool}
                onClick={onStar}
                aria-label={item.starred ? "Unstar" : "Star"}
                data-active={item.starred ? "true" : undefined}
              >
                <ExIcon name="star" filled={item.starred} />
              </button>
              <button type="button" className={styles.sendButton} onClick={onSend}>
                <ExIcon name="send" />
                <span>Send</span>
              </button>
            </>
          )}
        </div>
        <dl className={styles.facts}>
          <div>
            <dt>Location</dt>
            <dd>{where}</dd>
          </div>
          <div>
            <dt>{item.type === "file" ? "Added" : "Changed"}</dt>
            <dd>{fmtDate(item.date)}</dd>
          </div>
          {item.type !== "file" && (
            <div>
              <dt>Holds</dt>
              <dd>
                {plural(item.count, item.type === "folder" ? "item" : "file")}
                {item.size ? ` · ${formatSize(item.size)}` : ""}
              </dd>
            </div>
          )}
          {item.type === "delivery" && (
            <div>
              <dt>Link</dt>
              <dd className={styles.stateText} data-state={item.delivery.state}>
                {{ draft: "Draft, not sent yet", live: "Live", paused: "Paused", expired: "Expired" }[item.delivery.state]}
                {item.delivery.clientName ? ` · for ${item.delivery.clientName}` : ""}
              </dd>
            </div>
          )}
          {inCollections.length > 0 && (
            <div>
              <dt>In collections</dt>
              <dd className={styles.chips}>
                {inCollections.map((collection) => (
                  <button key={collection.id} type="button" className={styles.chip} onClick={() => onOpenCollection(collection.id)}>
                    {collection.name}
                  </button>
                ))}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </aside>
  );
}

// ---------- Context menu ----------

type MenuEntry =
  | { separator: true }
  | {
      label: string;
      icon: ExIconName;
      onSelect: () => void;
      danger?: boolean;
      disabled?: boolean;
      sub?: MenuEntry[];
      key?: string;
      separator?: undefined;
    };

function menuEntries(context: {
  list: Item[];
  live: Loc;
  model: Model;
  canMakeFolder: boolean;
  uploadTarget: UploadTarget | null;
  open: (item: Item) => void;
  startRename: (item: Item) => void;
  moveTo: (list: Item[]) => void;
  starItems: (list: Item[]) => void;
  removeItems: (list: Item[]) => void;
  collect: (collectionId: string, list: Item[]) => void;
  uncollect: (list: Item[]) => void;
  sendItems: (list: Item[]) => void;
  download: (list: Item[]) => void;
  copyIn: (list: Item[]) => void;
  newFolder: (kind: "folder" | "collection") => void;
  pickUpload: () => void;
  refresh: () => void;
  selectAll: () => void;
  openDelivery: (id: string) => void;
}): MenuEntry[] {
  const { list } = context;
  if (!list.length) {
    return [
      ...(context.canMakeFolder ? [{ label: "New folder", icon: "folderPlus" as const, onSelect: () => context.newFolder("folder") }] : []),
      { label: "New collection", icon: "collection", onSelect: () => context.newFolder("collection") },
      ...(context.uploadTarget ? [{ label: "Upload files", icon: "upload" as const, onSelect: context.pickUpload }] : []),
      { separator: true },
      { label: "Select all", icon: "select", onSelect: context.selectAll },
      { label: "Refresh", icon: "refresh", onSelect: context.refresh },
    ];
  }
  const one = list.length === 1 ? list[0] : null;
  const own = list.filter(
    (item) => (item.type === "file" && item.file.source === "library") || item.type === "folder" || item.type === "collection",
  );
  const sent = list.filter((item) => item.type === "file" && item.file.source === "delivery");
  const files = list.filter((item) => item.type === "file");
  const entries: MenuEntry[] = [];
  if (one)
    entries.push({
      label: one.type === "file" ? "Preview" : "Open",
      icon: one.type === "file" ? "panel" : "open",
      onSelect: () => context.open(one),
    });
  if (one?.type === "delivery") entries.push({ label: "Open in editor", icon: "open", onSelect: () => context.openDelivery(one.id) });
  if (files.length)
    entries.push({
      label: files.length > 1 ? `Download ${files.length} files` : "Download",
      icon: "download",
      onSelect: () => context.download(files),
    });
  if (sent.length) entries.push({ label: "Copy to My files", icon: "copy", onSelect: () => context.copyIn(sent) });
  if (own.length) {
    entries.push({ separator: true });
    entries.push({ label: "Send as delivery", icon: "send", onSelect: () => context.sendItems(own) });
    const collections = context.model.collections;
    const collectable = own.filter((item) => item.type === "file" || item.type === "folder");
    if (collectable.length) {
      entries.push({
        label: "Add to collection",
        icon: "collection",
        onSelect: () => undefined,
        sub: [
          ...collections
            .filter((collection) => !(context.live.kind === "collection" && context.live.id === collection.id))
            .map((collection) => ({
              label: collection.name,
              icon: "collection" as const,
              key: collection.id,
              onSelect: () => context.collect(collection.id, collectable),
            })),
          ...(collections.length ? [{ separator: true as const }] : []),
          { label: "New collection…", icon: "plus", onSelect: () => context.newFolder("collection") },
        ],
      });
    }
    if (context.live.kind === "collection" && files.length)
      entries.push({ label: "Remove from collection", icon: "remove", onSelect: () => context.uncollect(files) });
    entries.push({ separator: true });
    if (one && own.length === 1) entries.push({ label: "Rename", icon: "rename", onSelect: () => context.startRename(one) });
    if (own.some((item) => item.type !== "collection"))
      entries.push({ label: "Move to…", icon: "move", onSelect: () => context.moveTo(own) });
    entries.push({
      label: own.every((item) => item.starred) ? "Remove star" : "Star",
      icon: "star",
      onSelect: () => context.starItems(own),
    });
    entries.push({ separator: true });
    entries.push({ label: "Delete", icon: "trash", danger: true, onSelect: () => context.removeItems(own) });
  }
  return entries;
}

function ContextMenu({ menu, build, onClose }: { menu: NonNullable<Menu>; build: () => MenuEntry[]; onClose: () => void }) {
  const [entries] = useState(build);
  const ref = useRef<HTMLDivElement>(null);
  const [sub, setSub] = useState<number | null>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const key = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", key);
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", key);
    };
  }, [onClose]);
  return (
    <div
      ref={ref}
      className={styles.menu}
      role="menu"
      style={{ left: menu.x, top: menu.y, position: "fixed" }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {entries.map((entry, index) =>
        entry.separator ? (
          index > 0 && index < entries.length - 1 ? (
            <span key={index} className={styles.menuSeparator} role="separator" />
          ) : null
        ) : (
          <div key={entry.label} className={styles.menuWrap} onMouseEnter={() => setSub(entry.sub ? index : null)}>
            <button
              type="button"
              role="menuitem"
              className={styles.menuItem}
              data-danger={entry.danger ? "true" : undefined}
              aria-haspopup={entry.sub ? "menu" : undefined}
              aria-expanded={entry.sub ? sub === index : undefined}
              onClick={() => (entry.sub ? setSub(sub === index ? null : index) : entry.onSelect())}
            >
              <span className={styles.menuIcon}>
                <ExIcon name={entry.icon} size={16} />
              </span>
              <span>{entry.label}</span>
              {entry.sub && (
                <span className={styles.menuHint}>
                  <ExIcon name="chevron" size={13} />
                </span>
              )}
            </button>
            {entry.sub && sub === index && (
              <div className={`${styles.menu} ${styles.subMenu}`} role="menu">
                {entry.sub.map((child, childIndex) =>
                  child.separator ? (
                    <span key={childIndex} className={styles.menuSeparator} role="separator" />
                  ) : (
                    <button
                      key={child.key ?? child.label}
                      type="button"
                      role="menuitem"
                      className={styles.menuItem}
                      onClick={child.onSelect}
                    >
                      <span className={styles.menuIcon}>
                        <ExIcon name={child.icon} size={16} />
                      </span>
                      <span>{child.label}</span>
                    </button>
                  ),
                )}
              </div>
            )}
          </div>
        ),
      )}
    </div>
  );
}

// ---------- Uploads ----------

function UploadPanel({
  jobs,
  onCancel,
  onClear,
}: {
  jobs: ReturnType<typeof useLibraryUploads>["jobs"];
  onCancel: (id: string) => void;
  onClear: () => void;
}) {
  const [small, setSmall] = useState(false);
  const active = jobs.filter((job) => !job.done && !job.error);
  const sent = jobs.reduce((sum, job) => sum + Math.min(job.loaded, job.size), 0);
  const total = jobs.reduce((sum, job) => sum + job.size, 0);
  return (
    <div className={styles.uploads} role="region" aria-label="Uploads">
      <div className={styles.uploadsHead}>
        <span>
          {active.length
            ? `Uploading ${active.length} of ${jobs.length}`
            : `${plural(jobs.filter((job) => job.done).length, "upload")} done`}
        </span>
        <span className={styles.uploadsButtons}>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => setSmall((value) => !value)}
            aria-label={small ? "Show uploads" : "Hide uploads"}
          >
            <ExIcon name={small ? "up" : "chevronDown"} size={16} />
          </button>
          {!active.length && (
            <button type="button" className={styles.iconButton} onClick={onClear} aria-label="Close">
              <ExIcon name="close" size={16} />
            </button>
          )}
        </span>
      </div>
      <progress className={styles.uploadsBar} value={sent} max={Math.max(total, 1)} />
      {!small && (
        <ul className={styles.uploadList}>
          {jobs.map((job) => (
            <li key={job.id} data-state={job.error ? "error" : job.done ? "done" : "busy"}>
              <span className={styles.uploadName}>{job.name}</span>
              <span className={styles.uploadMeta}>
                {job.error
                  ? job.error
                  : job.done
                    ? formatSize(job.size)
                    : `${Math.round((Math.min(job.loaded, job.size) / Math.max(job.size, 1)) * 100)}%`}
              </span>
              {job.done ? (
                <span className={styles.uploadDone}>
                  <ExIcon name="check" size={14} />
                </span>
              ) : (
                <button type="button" className={styles.uploadCancel} onClick={() => onCancel(job.id)} aria-label={`Cancel ${job.name}`}>
                  <ExIcon name="close" size={13} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------- Dialogs ----------

function DialogView({ dialog, model, onClose }: { dialog: NonNullable<Dialog>; model: Model; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());

  useEffect(() => {
    const node = ref.current;
    if (node && !node.open) node.showModal();
  }, []);

  const finish = async (work: () => Promise<string | null>) => {
    setPending(true);
    setError(null);
    const problem = await work();
    setPending(false);
    if (problem) setError(problem);
    else onClose();
  };

  const renderFolders = (parent: string, depth: number): React.ReactNode =>
    (model.subfolders.get(parent) ?? []).map((folder) => {
      if (dialog.kind === "move" && dialog.exclude.has(folder.id)) return null;
      const kids = (model.subfolders.get(folder.id) ?? []).filter((child) => !(dialog.kind === "move" && dialog.exclude.has(child.id)));
      const expanded = open.has(folder.id);
      return (
        <li key={folder.id}>
          <div
            className={styles.pickRow}
            style={{ "--depth": depth } as React.CSSProperties}
            data-active={target === folder.id ? "true" : undefined}
          >
            {kids.length ? (
              <button
                type="button"
                className={styles.twisty}
                data-open={expanded ? "true" : undefined}
                aria-label={expanded ? "Collapse" : "Expand"}
                onClick={() =>
                  setOpen((current) => {
                    const next = new Set(current);
                    if (next.has(folder.id)) next.delete(folder.id);
                    else next.add(folder.id);
                    return next;
                  })
                }
              >
                <ExIcon name="chevron" size={13} />
              </button>
            ) : (
              <span className={styles.twistySpace} />
            )}
            <button
              type="button"
              className={styles.treeLink}
              onClick={() => setTarget(folder.id)}
              onDoubleClick={() => finish(() => (dialog as Extract<Dialog, { kind: "move" }>).submit(folder.id))}
            >
              <span className={styles.treeIcon} data-tone="teal">
                <ExIcon name="folder" filled size={17} />
              </span>
              <span className={styles.treeText}>{folder.name}</span>
            </button>
          </div>
          {expanded && <ul>{renderFolders(folder.id, depth + 1)}</ul>}
        </li>
      );
    });

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      onClose={onClose}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        method="dialog"
        className={styles.dialogBody}
        onSubmit={(event) => {
          event.preventDefault();
          if (dialog.kind === "name") {
            const value = String(new FormData(event.currentTarget).get("name") ?? "");
            void finish(() => dialog.submit(value));
          } else if (dialog.kind === "move") void finish(() => dialog.submit(target));
          else void finish(() => dialog.submit());
        }}
      >
        <h2 className={styles.dialogTitle}>{dialog.title}</h2>
        {dialog.kind === "name" && (
          <label className={styles.field}>
            <span>{dialog.label}</span>
            <input
              name="name"
              defaultValue={dialog.initial}
              autoFocus
              maxLength={200}
              required
              onFocus={(event) => event.currentTarget.select()}
            />
          </label>
        )}
        {dialog.kind === "confirm" && <p className={styles.dialogText}>{dialog.body}</p>}
        {dialog.kind === "move" && (
          <div className={styles.picker}>
            <ul>
              <li>
                <div
                  className={styles.pickRow}
                  style={{ "--depth": 0 } as React.CSSProperties}
                  data-active={target === null ? "true" : undefined}
                >
                  <span className={styles.twistySpace} />
                  <button type="button" className={styles.treeLink} onClick={() => setTarget(null)}>
                    <span className={styles.treeIcon} data-tone="teal">
                      <ExIcon name="drive" size={17} />
                    </span>
                    <span className={styles.treeText}>My files</span>
                  </button>
                </div>
                <ul>{renderFolders("root", 1)}</ul>
              </li>
            </ul>
          </div>
        )}
        {error && (
          <p className={styles.dialogError} role="alert">
            {error}
          </p>
        )}
        <div className={styles.dialogActions}>
          <button type="button" className={styles.tool} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={dialog.kind === "confirm" ? styles.dangerButton : styles.sendButton} disabled={pending}>
            {pending ? "Working…" : dialog.confirm}
          </button>
        </div>
      </form>
    </dialog>
  );
}
