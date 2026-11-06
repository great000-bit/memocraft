import { pool } from "@/lib/auth";
import { abortMultipart, completeMultipart, newObjectKey, startMultipart, storageConfigured, uploadPart } from "@/lib/storage";

export const maxDuration = 300;

// Copies a file into storage from a public address, for files too big to upload through a browser we do not have
// (a launch film for a partner, say). There is nothing to call it with: a job exists only when someone with database
// access sets "pending" = {"importFrom": "<url>", "type": "video/mp4"} on a deliveryFile row with no "storageKey". So the
// route needs no secret; calling it when no job is queued does nothing. Sources are limited to this repository's raw files.
const ALLOWED = "https://raw.githubusercontent.com/great000-bit/memocraft/";
const PART = 16 * 1024 * 1024;

type Job = { id: string; deliveryId: string; pending: { importFrom?: string; type?: string; startedAt?: string } };

export async function GET() {
  if (!storageConfigured()) return Response.json({ error: "storage off" }, { status: 503 });
  // Claim one job; a job started in the last 10 minutes is left to the run that started it.
  const { rows } = await pool.query<Job>(
    `update "deliveryFile" f set "pending" = f."pending" || jsonb_build_object('startedAt', now()::text)
       from "deliverySection" s
      where s."id" = f."sectionId" and f."id" = (
        select f2."id" from "deliveryFile" f2
         where f2."storageKey" is null and f2."pending" ? 'importFrom'
           and (not f2."pending" ? 'startedAt' or (f2."pending"->>'startedAt')::timestamptz < now() - interval '10 minutes')
         limit 1 for update skip locked)
      returning f."id", s."deliveryId", f."pending"`,
  );
  const job = rows[0];
  if (!job) return Response.json({ imported: 0 });
  const url = job.pending.importFrom ?? "";
  if (!url.startsWith(ALLOWED)) return Response.json({ error: "source not allowed" }, { status: 400 });

  const response = await fetch(url);
  if (!response.ok || !response.body) return Response.json({ error: `source ${response.status}` }, { status: 502 });
  const type = job.pending.type || "application/octet-stream";
  const key = newObjectKey(job.deliveryId, job.id);
  const uploadId = await startMultipart(key, type);
  const sizes: number[] = [];
  try {
    const reader = response.body.getReader();
    // R2 wants every part but the last to be the same size, so parts are cut at exactly PART bytes.
    let part = new Uint8Array(PART);
    let held = 0;
    const flush = async () => {
      sizes.push(held);
      await uploadPart(key, uploadId, sizes.length, part.subarray(0, held));
      part = new Uint8Array(PART);
      held = 0;
    };
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      let at = 0;
      while (at < value.length) {
        const take = Math.min(PART - held, value.length - at);
        part.set(value.subarray(at, at + take), held);
        held += take;
        at += take;
        if (held === PART) await flush();
      }
    }
    if (held > 0 || sizes.length === 0) await flush();
    if (!(await completeMultipart(key, uploadId, sizes))) throw new Error("parts did not match");
  } catch (error) {
    await abortMultipart(key, uploadId).catch(() => {});
    console.error("Import failed", error);
    return Response.json({ error: "import failed" }, { status: 500 });
  }
  const size = sizes.reduce((a, b) => a + b, 0);
  // The row's own "ext" is kept: rows are named without the extension, which is added back on download.
  await pool.query(
    `update "deliveryFile" set "storageKey" = $1, "sizeBytes" = $2, "mimeType" = $3, "pending" = null where "id" = $4`,
    [key, size, type, job.id],
  );
  return Response.json({ imported: 1, size });
}
