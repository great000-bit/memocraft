// The one line that says what a client did, shared by the live notes and the Notifications page.
type NoticeLike = {
  kind: "open" | "download" | "request";
  title: string;
  clientName: string | null;
  fileName: string | null;
  count: number;
};

function who(notice: NoticeLike) {
  return notice.clientName?.trim() || "Your client";
}

export function line(notice: NoticeLike) {
  if (notice.kind === "open") return `${who(notice)} opened ${notice.title}`;
  if (notice.kind === "request") return `${who(notice)} asked about ${notice.fileName ?? "a new file"}`;
  if (notice.count > 1) return `${who(notice)} saved ${notice.count} files`;
  return `${who(notice)} saved ${notice.fileName ?? "a file"}`;
}
