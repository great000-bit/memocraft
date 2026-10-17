"use server";

import { revalidatePath } from "next/cache";
import { pool } from "./auth";
import { getPublishedRef, isUuid } from "./deliveries";
import { limits } from "./delivery-limits";
import { emailConfigured, sendInBackground } from "./email";
import { requestEmail } from "./email-templates";
import { passesPassword } from "./link-access";
import { requireUser } from "./session";

export type RequestResult = { ok: true } | { ok: false; error: string };

const fail = (error: string): RequestResult => ({ ok: false, error });

// How many requests one link takes in an hour, and how many may wait unanswered. Nothing identifies a client, so
// the limits are per delivery: enough for a real conversation, not enough to bury the creative.
const perHour = 5;
const waitingMax = 30;

// A client asks for something from the client page. Open to anyone who can see the delivery: the link must be live
// and, when it has a password, this browser must have typed it. Nothing about the client is stored.
export async function submitRequest(slug: string, formData: FormData): Promise<RequestResult> {
  const ref = await getPublishedRef(typeof slug === "string" ? slug : "");
  if (!ref || !(await passesPassword(ref.id, ref.passwordHash))) return fail("This link is not available.");

  const raw = formData.get("message");
  const message = typeof raw === "string" ? raw.trim() : "";
  if (message.length < 3) return fail("Say what you need, in a few words.");
  if (message.length > limits.request) return fail(`Keep it under ${limits.request} characters.`);

  const fileValue = formData.get("file");
  let fileId: string | null = null;
  let fileName: string | null = null;
  if (typeof fileValue === "string" && fileValue !== "") {
    if (!isUuid(fileValue)) return fail("That file was not found.");
    const file = await pool.query<{ name: string }>(
      `select f."name" from "deliveryFile" f join "deliverySection" s on s."id" = f."sectionId"
        where f."id" = $1 and s."deliveryId" = $2 and f."storageKey" is not null`,
      [fileValue, ref.id],
    );
    if (!file.rows[0]) return fail("That file was not found.");
    fileId = fileValue;
    fileName = file.rows[0].name;
  }

  const counts = await pool.query<{ recent: string; waiting: string }>(
    `select count(*) filter (where "createdAt" > now() - interval '1 hour') as "recent",
            count(*) filter (where "status" = 'open') as "waiting"
       from "fileRequest" where "deliveryId" = $1`,
    [ref.id],
  );
  if (Number(counts.rows[0].recent) >= perHour || Number(counts.rows[0].waiting) >= waitingMax) {
    return fail("Too many requests are waiting. Try again a little later.");
  }

  await pool.query(`insert into "fileRequest" ("deliveryId", "fileId", "fileName", "message") values ($1, $2, $3, $4)`, [
    ref.id,
    fileId,
    fileName,
    message,
  ]);
  revalidatePath("/requests");
  revalidatePath("/dashboard");
  revalidatePath(`/deliveries/${ref.id}`);
  if (emailConfigured()) await emailOwner(ref.id, fileName, message);
  return { ok: true };
}

// The creative hears about it by email too, sent after the client's answer so the client never waits on it.
async function emailOwner(deliveryId: string, fileName: string | null, message: string) {
  const { rows } = await pool.query<{ email: string; name: string; title: string; clientName: string | null }>(
    `select u."email", u."name", d."title", d."clientName"
       from "delivery" d join "user" u on u."id" = d."ownerId" where d."id" = $1`,
    [deliveryId],
  );
  const owner = rows[0];
  const base = process.env.BETTER_AUTH_URL;
  if (!owner || !base) return;
  sendInBackground(
    requestEmail({
      to: owner.email,
      ownerName: owner.name,
      clientName: owner.clientName,
      deliveryTitle: owner.title,
      fileName,
      message,
      url: new URL("/requests", base).toString(),
    }),
  );
}

// The creative marks a request handled, or opens it again.
export async function setRequestDone(requestId: string, done: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  if (!isUuid(requestId)) return { ok: false, error: "This request was not found." };
  const result = await pool.query<{ deliveryId: string }>(
    `update "fileRequest" r
        set "status" = case when $2::boolean then 'done' else 'open' end,
            "doneAt" = case when $2::boolean then now() else null end
       from "delivery" d
      where r."id" = $1 and d."id" = r."deliveryId" and d."ownerId" = $3
      returning r."deliveryId"`,
    [requestId, done, user.id],
  );
  if (!result.rows[0]) return { ok: false, error: "This request was not found." };
  revalidatePath("/requests");
  revalidatePath("/dashboard");
  revalidatePath(`/deliveries/${result.rows[0].deliveryId}`);
  return { ok: true };
}
