// The cover a client sees first: one of the designed templates, the words the creative wrote for it, and the photo
// it is built on. Safe to import from client components.

export const coverTemplates = [
  { id: "classic", name: "Classic", note: "Full photo, centred capitals, outlined button" },
  { id: "editorial", name: "Editorial", note: "Serif title low on the left" },
  { id: "split", name: "Split", note: "Photo left, words on black" },
  { id: "gallery", name: "Gallery wall", note: "Words left, framed photo right" },
  { id: "frame", name: "Passe-partout", note: "A mounted print with a museum label" },
  { id: "monogram", name: "Monogram", note: "Type only, a large initial behind" },
  { id: "poster", name: "Poster", note: "Tall condensed capitals over the photo" },
  { id: "whisper", name: "Whisper", note: "Full photo, small type in the corners" },
  { id: "cinema", name: "Cinema", note: "Widescreen band with credits" },
  { id: "cover", name: "Cover story", note: "Magazine masthead over the photo" },
  { id: "keepsake", name: "Keepsake", note: "A tilted print with a caption" },
  { id: "arch", name: "Arch", note: "Photo in an arch, serif below" },
  { id: "halo", name: "Halo", note: "Round photo ringed by the title" },
  { id: "diptych", name: "Diptych", note: "Two photos side by side" },
  { id: "contact", name: "Contact sheet", note: "A strip of frames, numbered" },
  { id: "spine", name: "Spine", note: "Title runs up the edge" },
  { id: "aurora", name: "Aurora", note: "Photo fading into black, soft glow" },
  { id: "tealprint", name: "Teal print", note: "Duotone in Memocraft teal" },
  { id: "invitation", name: "Invitation", note: "A framed card over a soft photo" },
  { id: "swiss", name: "Swiss", note: "Strict grid, big type, labelled facts" },
] as const;

export type CoverTemplateId = (typeof coverTemplates)[number]["id"];

export const isCoverTemplate = (value: unknown): value is CoverTemplateId =>
  typeof value === "string" && coverTemplates.some((template) => template.id === value);

// What is stored on the delivery. "key" is the large cover picture made from "fileId"; only the server sets either.
export type Cover = {
  template: CoverTemplateId;
  kicker: string | null;
  subtitle: string | null;
  button: string | null;
  // Where the photo is held when cropped, as percentages across and down.
  focusX: number;
  focusY: number;
  // How strongly the background picture shows over the black, from 10 to 100 percent.
  opacity: number;
  // "upload" when the creative put in a picture of their own instead of one of the delivery's photos.
  source: "file" | "upload";
  fileId: string | null;
  key: string | null;
};

// The words a creative types. The title is the delivery's own title.
export type CoverText = { title: string; kicker: string; subtitle: string; button: string };

export const coverLimits = { kicker: 80, subtitle: 80, button: 30, opacityMin: 10, uploadBytes: 12 * 1024 * 1024 } as const;

const coverDate = new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" });

// A delivery that has never been through the designer still opens on a finished cover: the classic template, who it
// is for, and the date.
export function coverDefaults(delivery: { clientName: string | null; publishedAt: Date | null; updatedAt: Date }): Omit<Cover, "fileId" | "key" | "source"> {
  return {
    template: "classic",
    kicker: delivery.clientName ? `For ${delivery.clientName}` : "",
    subtitle: coverDate.format(delivery.publishedAt ?? delivery.updatedAt),
    button: "View gallery",
    focusX: 50,
    focusY: 40,
    opacity: 100,
  };
}

// Reads whatever is stored, keeping only what is valid. Unknown or missing parts fall back to the defaults.
export function readCover(stored: unknown, delivery: { clientName: string | null; publishedAt: Date | null; updatedAt: Date }): Cover {
  const base = coverDefaults(delivery);
  const raw = stored && typeof stored === "object" ? (stored as Record<string, unknown>) : {};
  const text = (value: unknown, fallback: string | null) => (typeof value === "string" ? value : fallback);
  const percent = (value: unknown, fallback: number) =>
    typeof value === "number" && Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : fallback;
  return {
    template: isCoverTemplate(raw.template) ? raw.template : base.template,
    kicker: text(raw.kicker, base.kicker),
    subtitle: text(raw.subtitle, base.subtitle),
    button: text(raw.button, base.button),
    focusX: percent(raw.focusX, base.focusX),
    focusY: percent(raw.focusY, base.focusY),
    opacity: Math.max(coverLimits.opacityMin, percent(raw.opacity, base.opacity)),
    source: raw.source === "upload" ? "upload" : "file",
    fileId: typeof raw.fileId === "string" ? raw.fileId : null,
    key: typeof raw.key === "string" ? raw.key : null,
  };
}
