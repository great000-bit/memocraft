// Line icons for Memo Explorer's toolbar, tree and menus. Decorative: every control that uses one also has a label.
const paths = {
  back: <path d="M15 5l-7 7 7 7" />,
  forward: <path d="M9 5l7 7-7 7" />,
  up: <path d="M12 19V6m0 0-6 6m6-6 6 6" />,
  refresh: (
    <>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.5 4.5v4h-4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  upload: (
    <>
      <path d="M12 15V4m0 0-4.5 4.5M12 4l4.5 4.5" />
      <path d="M4.5 14.5v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5" />
      <path d="M4.5 14.5v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3" />
    </>
  ),
  rename: (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M13.5 6.5l4 4" />
    </>
  ),
  move: (
    <>
      <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
      <path d="M10 13.5h6m0 0-2.5-2.5M16 13.5 13.5 16" />
    </>
  ),
  star: <path d="m12 3.8 2.5 5.1 5.6.8-4 4 .9 5.6-5-2.7-5 2.7.9-5.6-4-4 5.6-.8z" />,
  trash: (
    <>
      <path d="M4.5 7h15M9.5 7V4.5h5V7" />
      <path d="M6.5 7l.8 11.5a2 2 0 0 0 2 1.8h5.4a2 2 0 0 0 2-1.8L17.5 7" />
      <path d="M10 11v5M14 11v5" />
    </>
  ),
  sort: (
    <>
      <path d="M7 4v16m0 0-3-3m3 3 3-3" />
      <path d="M17 20V4m0 0-3 3m3-3 3 3" />
    </>
  ),
  grid: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.6" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6" />
    </>
  ),
  list: (
    <>
      <path d="M9 6.5h11M9 12h11M9 17.5h11" />
      <circle cx="4.75" cy="6.5" r="1" />
      <circle cx="4.75" cy="12" r="1" />
      <circle cx="4.75" cy="17.5" r="1" />
    </>
  ),
  send: (
    <>
      <path d="M20.5 3.5 10 14" />
      <path d="M20.5 3.5 14 20.5l-4-6.5-6.5-4z" />
    </>
  ),
  panel: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <path d="M14.5 4.5v15" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15 15 5 5" />
    </>
  ),
  chevron: <path d="m9 6 6 6-6 6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  more: (
    <>
      <circle cx="5.5" cy="12" r="1.3" />
      <circle cx="12" cy="12" r="1.3" />
      <circle cx="18.5" cy="12" r="1.3" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  folder: <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />,
  folderPlus: (
    <>
      <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
      <path d="M12 11v5M9.5 13.5h5" />
    </>
  ),
  collection: (
    <>
      <rect x="6.5" y="7.5" width="13" height="12" rx="2" />
      <path d="M4.5 16V7a2.5 2.5 0 0 1 2.5-2.5h9" />
    </>
  ),
  delivery: (
    <>
      <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
      <path d="m9.5 13.5 2 2 3.5-4" />
    </>
  ),
  drive: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="3" />
      <path d="M3.5 14h17" />
      <circle cx="16.5" cy="16.6" r=".9" />
    </>
  ),
  open: (
    <>
      <path d="M14 4.5h5.5V10" />
      <path d="M19.5 4.5 11 13" />
      <path d="M17 13.5v4a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h4" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M15.5 8.5v-2a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" />
    </>
  ),
  remove: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 12h7" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h10" />,
  select: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="m8.5 12.3 2.4 2.4 4.8-5" />
    </>
  ),
} as const;

export type ExIconName = keyof typeof paths;

export function ExIcon({ name, filled, size = 18 }: { name: ExIconName; filled?: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}

// What kind of file this is, for its icon colour and the Type column.
export type FileKind = "image" | "video" | "audio" | "pdf" | "doc" | "sheet" | "slides" | "design" | "archive" | "raw" | "other";

const extKinds: Record<string, FileKind> = {
  pdf: "pdf",
  doc: "doc",
  docx: "doc",
  txt: "doc",
  rtf: "doc",
  pages: "doc",
  md: "doc",
  xls: "sheet",
  xlsx: "sheet",
  csv: "sheet",
  numbers: "sheet",
  ppt: "slides",
  pptx: "slides",
  key: "slides",
  psd: "design",
  ai: "design",
  fig: "design",
  sketch: "design",
  indd: "design",
  eps: "design",
  svg: "design",
  zip: "archive",
  rar: "archive",
  "7z": "archive",
  tar: "archive",
  gz: "archive",
  cr2: "raw",
  cr3: "raw",
  nef: "raw",
  arw: "raw",
  dng: "raw",
  raf: "raw",
  orf: "raw",
  rw2: "raw",
};

export function fileKind(mime: string | null, ext: string | null): FileKind {
  const e = (ext ?? "").toLowerCase();
  if (extKinds[e]) return extKinds[e];
  if (mime?.startsWith("image/")) return "image";
  if (mime?.startsWith("video/")) return "video";
  if (mime?.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "pdf";
  return "other";
}

export const kindLabel: Record<FileKind, string> = {
  image: "Picture",
  video: "Video",
  audio: "Audio",
  pdf: "PDF",
  doc: "Document",
  sheet: "Spreadsheet",
  slides: "Presentation",
  design: "Design file",
  archive: "Archive",
  raw: "RAW photo",
  other: "File",
};

// A large document glyph for files without a picture: a sheet with a folded corner and the extension on a colour
// band picked from the file's kind.
export function DocGlyph({ ext, kind }: { ext: string | null; kind: FileKind }) {
  const label = (ext ?? "file").slice(0, 4).toUpperCase();
  return (
    <svg viewBox="0 0 64 80" data-kind={kind} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="docSheet" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b1f1e" />
          <stop offset="1" stopColor="#0d0f0f" />
        </linearGradient>
      </defs>
      <path d="M10 2h30l20 20v50a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6V8a6 6 0 0 1 6-6z" fill="url(#docSheet)" stroke="rgb(255 255 255 / 0.14)" />
      <path d="M40 2v14a6 6 0 0 0 6 6h14" fill="none" stroke="rgb(255 255 255 / 0.14)" />
      <rect x="4" y="48" width="56" height="16" fill="var(--doc-band)" />
      <text
        x="32"
        y="59.5"
        textAnchor="middle"
        fontSize="10"
        fontWeight="700"
        letterSpacing="0.6"
        fill="var(--doc-ink)"
        fontFamily="var(--font-mono)"
      >
        {label}
      </text>
    </svg>
  );
}
