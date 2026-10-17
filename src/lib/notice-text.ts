// The one line that says what a client did, shared by the live notes and the Notifications page.
export type NoticeKind = "open" | "download" | "request" | "approval" | "comment" | "favourite" | "reminder" | "reminded";

type NoticeLike = {
  kind: NoticeKind;
  deliveryId?: string;
  title: string;
  clientName: string | null;
  fileName: string | null;
  count: number;
};

function who(notice: NoticeLike) {
  return notice.clientName?.trim() || "Your client";
}

export function line(notice: NoticeLike) {
  switch (notice.kind) {
    case "open":
      return `${who(notice)} opened ${notice.title}`;
    case "request":
      return `${who(notice)} asked about ${notice.fileName ?? "a new file"}`;
    case "approval":
      return notice.fileName ? `${who(notice)} approved ${notice.fileName}` : `${who(notice)} approved everything`;
    case "comment":
      return `${who(notice)} commented on ${notice.fileName ?? "a file"}`;
    case "favourite":
      return notice.count > 1 ? `${who(notice)} hearted ${notice.count} files` : `${who(notice)} hearted ${notice.fileName ?? "a file"}`;
    case "reminder":
      return `${who(notice)} has not opened ${notice.title} yet. Send a reminder`;
    case "reminded":
      return `We reminded ${who(notice)} about ${notice.title} by email`;
    default:
      if (notice.count > 1) return `${who(notice)} saved ${notice.count} files`;
      return `${who(notice)} saved ${notice.fileName ?? "a file"}`;
  }
}

// Where tapping a notice goes.
export function noticeHref(notice: { kind: NoticeKind; deliveryId: string }) {
  if (notice.kind === "request") return "/requests";
  if (notice.kind === "reminder") return `/deliveries/${notice.deliveryId}#reminders`;
  if (notice.kind === "approval" || notice.kind === "comment" || notice.kind === "favourite") return `/deliveries/${notice.deliveryId}#feedback`;
  return `/deliveries/${notice.deliveryId}`;
}

// Notices that are about a delivery rather than one device, so the second line names the delivery.
export const aboutDelivery = (kind: NoticeKind) => kind !== "open";
