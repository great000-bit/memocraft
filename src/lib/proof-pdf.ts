import { createHash } from "node:crypto";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { pool } from "./auth";
import { downloadName, type OwnerDelivery } from "./deliveries";
import { loadFeedback } from "./feedback";
import { getBranding, linkOrigin } from "./plan";
import { formatSize } from "./storage-limits";
import { getStudio } from "./studio";

// The proof of delivery certificate: what was sent, when the link was opened, what was downloaded and approved.
// It is built from the same records the editor shows, so it never says more than Memocraft knows. Times are in UTC
// so the document reads the same wherever it is opened.

const page = { width: 595.28, height: 841.89, margin: 48 } as const;
const ink = rgb(0x17 / 255, 0x1a / 255, 0x19 / 255);
const muted = rgb(0x5b / 255, 0x66 / 255, 0x62 / 255);
const teal = rgb(0x0b / 255, 0x6b / 255, 0x5d / 255);
const amber = rgb(0xe8 / 255, 0xa3 / 255, 0x3d / 255);
const amberText = rgb(0x8a / 255, 0x52 / 255, 0x08 / 255);
const sage = rgb(0xee / 255, 0xf2 / 255, 0xf0 / 255);
const rule = rgb(0xd9 / 255, 0xde / 255, 0xdc / 255);

const stamp = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});
const when = (date: Date) => `${stamp.format(date)} UTC`;

// The built-in PDF fonts only carry Western European letters. Accents are kept where they exist there; anything
// else (emoji, other scripts) becomes "?" rather than breaking the document.
function plain(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/\s+/g, " ")
    .split("")
    .map((ch) => {
      const code = ch.charCodeAt(0);
      if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff)) return ch;
      const base = ch.normalize("NFKD").replace(/[̀-ͯ]/g, "");
      return base && [...base].every((c) => c.charCodeAt(0) >= 0x20 && c.charCodeAt(0) <= 0x7e) ? base : "?";
    })
    .join("");
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = plain(text).split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= width) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    // A single word longer than the line (a long file name or link) is broken where it must be.
    let rest = word;
    while (font.widthOfTextAtSize(rest, size) > width && rest.length > 1) {
      let cut = rest.length - 1;
      while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > width) cut--;
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    current = rest;
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

type Column = { title: string; width: number };

class Writer {
  doc: PDFDocument;
  regular: PDFFont;
  bold: PDFFont;
  pages: PDFPage[] = [];
  current!: PDFPage;
  y = 0;

  constructor(doc: PDFDocument, regular: PDFFont, bold: PDFFont) {
    this.doc = doc;
    this.regular = regular;
    this.bold = bold;
    this.addPage();
  }

  addPage() {
    this.current = this.doc.addPage([page.width, page.height]);
    this.pages.push(this.current);
    this.y = page.height - page.margin;
  }

  room(height: number) {
    if (this.y - height < page.margin + 40) this.addPage();
  }

  text(value: string, options: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; x?: number; width?: number; gap?: number } = {}) {
    const size = options.size ?? 10;
    const font = options.font ?? this.regular;
    const width = options.width ?? page.width - page.margin * 2;
    const lines = wrap(value, font, size, width);
    const height = size * 1.4;
    for (const line of lines) {
      this.room(height);
      this.current.drawText(line, { x: options.x ?? page.margin, y: this.y - size, size, font, color: options.color ?? ink });
      this.y -= height;
    }
    this.y -= options.gap ?? 0;
  }

  heading(value: string) {
    this.room(48);
    this.y -= 14;
    this.current.drawRectangle({ x: page.margin, y: this.y - 14, width: 3, height: 14, color: amber });
    this.current.drawText(plain(value), { x: page.margin + 10, y: this.y - 12, size: 13, font: this.bold, color: ink });
    this.y -= 24;
  }

  // A plain table: a bold header row, then rows that wrap inside their column and keep together across pages.
  table(columns: Column[], rows: string[][], empty: string) {
    const size = 9;
    const lineHeight = size * 1.4;
    const drawHeader = () => {
      this.room(lineHeight + 8);
      let x = page.margin;
      for (const column of columns) {
        this.current.drawText(plain(column.title).toUpperCase(), { x, y: this.y - size, size: 7.5, font: this.bold, color: muted });
        x += column.width;
      }
      this.y -= lineHeight + 2;
      this.current.drawLine({
        start: { x: page.margin, y: this.y + 2 },
        end: { x: page.width - page.margin, y: this.y + 2 },
        thickness: 0.6,
        color: rule,
      });
      this.y -= 4;
    };
    drawHeader();
    if (rows.length === 0) {
      this.text(empty, { size, color: muted, gap: 4 });
      return;
    }
    for (const row of rows) {
      const cells = row.map((cell, index) => wrap(cell, index === 0 ? this.bold : this.regular, size, columns[index].width - 8));
      const height = Math.max(...cells.map((lines) => lines.length)) * lineHeight + 6;
      if (this.y - height < page.margin + 40) {
        this.addPage();
        drawHeader();
      }
      let x = page.margin;
      cells.forEach((lines, index) => {
        lines.forEach((line, lineIndex) => {
          this.current.drawText(line, {
            x,
            y: this.y - size - lineIndex * lineHeight,
            size,
            font: index === 0 ? this.bold : this.regular,
            color: index === 0 ? ink : muted,
          });
        });
        x += columns[index].width;
      });
      this.y -= height;
      this.current.drawLine({
        start: { x: page.margin, y: this.y + 3 },
        end: { x: page.width - page.margin, y: this.y + 3 },
        thickness: 0.4,
        color: rule,
      });
    }
  }
}

type EventRow = { kind: "open" | "download"; fileName: string | null; device: string; at: Date };

export async function proofPdf(
  delivery: OwnerDelivery,
  owner: { id: string; name: string; email: string },
): Promise<{ bytes: Uint8Array; fileName: string }> {
  const [events, feedback, studio, branding] = await Promise.all([
    pool.query<EventRow>(
      `select "kind", "fileName", "device", "at" from "deliveryEvent" where "deliveryId" = $1 order by "at", "id" limit 2000`,
      [delivery.id],
    ),
    loadFeedback(delivery),
    getStudio(owner.id),
    getBranding(owner.id),
  ]);
  const generated = new Date();
  const files = delivery.sections.flatMap((section) => section.files.filter((file) => file.attached));
  const opens = events.rows.filter((event) => event.kind === "open");
  const downloads = events.rows.filter((event) => event.kind === "download");
  const base = linkOrigin(branding) ?? process.env.BETTER_AUTH_URL ?? "https://memocraft-alpha.vercel.app";
  const link = new URL(`/d/${delivery.slug}`, base).toString();
  const sender = studio?.name ?? owner.name;
  const whole = feedback.approvals.find((approval) => approval.fileId === null && approval.current);

  // A fingerprint of what the document states, so two copies can be compared at a glance.
  const reference = createHash("sha256")
    .update(
      JSON.stringify({
        id: delivery.id,
        files: files.map((file) => [file.id, file.sizeBytes, file.replacedAt]),
        events: events.rows.map((event) => [event.kind, event.fileName, event.at]),
        approvals: feedback.approvals.map((approval) => [approval.id, approval.at]),
      }),
    )
    .digest("hex")
    .slice(0, 16)
    .toUpperCase()
    .replace(/(.{4})(?!$)/g, "$1-");

  const doc = await PDFDocument.create();
  doc.setTitle(plain(`Proof of delivery - ${delivery.title}`));
  doc.setAuthor(plain(sender));
  doc.setCreator("Memocraft");
  doc.setProducer("Memocraft");
  doc.setCreationDate(generated);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const w = new Writer(doc, regular, bold);

  // Wordmark: "M", amber "em", "ocraft".
  let x = page.margin;
  for (const [part, color] of [
    ["M", ink],
    ["em", amber],
    ["ocraft", ink],
  ] as const) {
    w.current.drawText(part, { x, y: w.y - 16, size: 16, font: bold, color });
    x += bold.widthOfTextAtSize(part, 16);
  }
  const label = "PROOF OF DELIVERY";
  w.current.drawText(label, {
    x: page.width - page.margin - bold.widthOfTextAtSize(label, 9),
    y: w.y - 14,
    size: 9,
    font: bold,
    color: amberText,
  });
  w.y -= 44;
  w.text(delivery.title, { size: 22, font: bold, gap: 4 });
  w.text(`Sent by ${sender}${delivery.clientName ? ` to ${delivery.clientName}` : ""}`, { size: 11, color: muted, gap: 14 });

  // Key facts in a sage panel.
  const facts: [string, string][] = [
    ["Link", link],
    ["First sent", delivery.publishedAt ? when(delivery.publishedAt) : "Not sent yet"],
    ["First opened", opens[0] ? `${when(opens[0].at)} on ${opens[0].device}` : "Not opened yet"],
    ["Times opened", String(opens.length)],
    ["Downloads started", String(downloads.length)],
    [
      "Approval",
      whole
        ? `All files approved${whole.name ? ` by ${whole.name}` : ""} on ${when(whole.at)}`
        : feedback.approvals.some((approval) => approval.current)
          ? `${new Set(feedback.approvals.filter((a) => a.current && a.fileId).map((a) => a.fileId)).size} of ${files.length} files approved`
          : "Not approved yet",
    ],
  ];
  const labelWidth = 110;
  const valueWidth = page.width - page.margin * 2 - labelWidth - 28;
  const factLines = facts.map(([, value]) => wrap(value, regular, 10, valueWidth).length);
  const panelHeight = factLines.reduce((sum, n) => sum + n * 14 + 6, 0) + 20;
  w.room(panelHeight);
  w.current.drawRectangle({
    x: page.margin,
    y: w.y - panelHeight,
    width: page.width - page.margin * 2,
    height: panelHeight,
    color: sage,
  });
  w.y -= 12;
  facts.forEach(([key, value]) => {
    w.current.drawText(plain(key), { x: page.margin + 14, y: w.y - 10, size: 9, font: bold, color: muted });
    const lines = wrap(value, regular, 10, valueWidth);
    lines.forEach((line, index) => {
      w.current.drawText(line, { x: page.margin + 14 + labelWidth, y: w.y - 10 - index * 14, size: 10, font: regular, color: key === "Approval" && whole ? teal : ink });
    });
    w.y -= lines.length * 14 + 6;
  });
  w.y -= 14;

  w.heading(`Files delivered (${files.length})`);
  w.table(
    [
      { title: "File", width: 200 },
      { title: "Size", width: 70 },
      { title: "Version", width: 150 },
      { title: "Downloads", width: 79 },
    ],
    files.map((file) => [
      downloadName(file.name, file.ext),
      file.sizeBytes ? formatSize(file.sizeBytes) : "-",
      file.replacedAt ? `Updated ${when(file.replacedAt)}` : `Added ${when(file.addedAt)}`,
      String(file.downloads),
    ]),
    "No files are attached.",
  );

  w.heading("Approvals");
  w.table(
    [
      { title: "When", width: 130 },
      { title: "What", width: 170 },
      { title: "By", width: 110 },
      { title: "Device", width: 89 },
    ],
    feedback.approvals
      .slice()
      .reverse()
      .map((approval) => [
        when(approval.at),
        `${approval.fileId ? approval.fileName ?? "A file" : "All files"}${approval.fileSize ? ` (${formatSize(approval.fileSize)})` : ""}${approval.current ? "" : ", an earlier version"}`,
        approval.name ?? "Not given",
        approval.device,
      ]),
    "The client has not approved anything yet.",
  );

  w.heading(`Activity (${events.rows.length})`);
  w.table(
    [
      { title: "When", width: 150 },
      { title: "What happened", width: 250 },
      { title: "Device", width: 99 },
    ],
    events.rows.map((event) => [
      when(event.at),
      event.kind === "open" ? "Opened the delivery page" : `Started downloading ${event.fileName ?? "a file"}`,
      event.device,
    ]),
    "Nobody has opened the link yet.",
  );

  w.y -= 10;
  w.text(
    "How this is recorded: an open is counted when the page has been on screen in a real browser for a moment; link previews, " +
      "bots and the sender's own visits are not counted. A download is counted when it starts. Memocraft keeps the kind of device " +
      "(such as iPhone) and the time. It does not keep IP addresses or other details that identify a person. Names next to " +
      "approvals are what the client typed.",
    { size: 8.5, color: muted, gap: 4 },
  );
  w.text(`Generated ${when(generated)} for ${owner.name} (${owner.email}). Reference ${reference}.`, { size: 8.5, color: muted });

  // Page numbers last, once the page count is known.
  w.pages.forEach((p, index) => {
    const footer = plain(`${delivery.title} · Proof of delivery · Page ${index + 1} of ${w.pages.length}`);
    p.drawText(footer, { x: page.margin, y: 26, size: 8, font: regular, color: muted });
  });

  const safe = delivery.title.normalize("NFKD").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "delivery";
  return { bytes: await doc.save(), fileName: `proof-of-delivery-${safe}.pdf` };
}
