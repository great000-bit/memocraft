import { pool } from "./auth";
import type { Delivery } from "./deliveries";

// What clients said back on a delivery: approvals, hearts and comments. Read by the client page (everyone with the
// link sees the same approvals and comments) and by the owner's editor and proof PDF.

export type Approval = {
  id: string;
  fileId: string | null;
  fileName: string | null;
  fileSize: number | null;
  fileVersionAt: Date | null;
  name: string | null;
  device: string;
  at: Date;
  // False once the file has a newer version, or, for the whole delivery, once a file was added or replaced after it.
  current: boolean;
};

export type FileComment = {
  id: string;
  fileId: string;
  message: string;
  x: number | null;
  y: number | null;
  name: string | null;
  fromOwner: boolean;
  // The client note a reply answers; null for a client's own note.
  parentId: string | null;
  createdAt: Date;
  resolved: boolean;
};

export type Feedback = {
  approvals: Approval[];
  // Hearts per file. The client page never shows counts, only the client's own hearts, which their browser keeps.
  favourites: Record<string, number>;
  comments: FileComment[];
};

export const noFeedback: Feedback = { approvals: [], favourites: {}, comments: [] };

type ApprovalRow = Omit<Approval, "current" | "fileSize"> & { fileSize: string | null };

// The time of the newest change to the files a client can see, to tell a whole-delivery approval that still holds
// from one that came before a new file.
function lastChange(delivery: Delivery): number {
  let latest = 0;
  for (const section of delivery.sections) {
    for (const file of section.files) {
      if (!file.attached) continue;
      latest = Math.max(latest, file.addedAt.getTime(), file.replacedAt?.getTime() ?? 0);
    }
  }
  return latest;
}

export async function loadFeedback(delivery: Delivery): Promise<Feedback> {
  const [approvals, favourites, comments] = await Promise.all([
    pool.query<ApprovalRow>(
      `select "id", "fileId", "fileName", "fileSize", "fileVersionAt", "name", "device", "at"
         from "approval" where "deliveryId" = $1 order by "at" desc, "id" limit 200`,
      [delivery.id],
    ),
    pool.query<{ fileId: string; n: number }>(
      `select "fileId", count(*)::int as "n" from "fileFavourite" where "deliveryId" = $1 group by "fileId"`,
      [delivery.id],
    ),
    pool.query<Omit<FileComment, "resolved"> & { resolvedAt: Date | null }>(
      `select "id", "fileId", "message", "x", "y", "name", "fromOwner", "parentId", "createdAt", "resolvedAt"
         from "fileComment" where "deliveryId" = $1 order by "createdAt", "id" limit 500`,
      [delivery.id],
    ),
  ]);
  const files = new Map(delivery.sections.flatMap((section) => section.files).map((file) => [file.id, file]));
  const changed = lastChange(delivery);
  return {
    approvals: approvals.rows.map((row) => {
      let current: boolean;
      if (row.fileId) {
        const file = files.get(row.fileId);
        current = Boolean(file?.attached) && (file!.replacedAt?.getTime() ?? null) === (row.fileVersionAt?.getTime() ?? null);
      } else {
        current = row.at.getTime() >= changed;
      }
      return { ...row, fileSize: row.fileSize === null ? null : Number(row.fileSize), current };
    }),
    favourites: Object.fromEntries(favourites.rows.map((row) => [row.fileId, row.n])),
    comments: comments.rows.map(({ resolvedAt, ...row }) => ({ ...row, resolved: resolvedAt !== null })),
  };
}

// The approval that counts for a file right now (or for the whole delivery, with null), newest first.
export function currentApproval(feedback: Feedback, fileId: string | null): Approval | undefined {
  return feedback.approvals.find((approval) => approval.current && approval.fileId === fileId);
}
