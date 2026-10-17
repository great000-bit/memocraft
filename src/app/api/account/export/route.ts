import { pool } from "@/lib/auth";
import { signInMethods } from "@/lib/profile";
import { getSession } from "@/lib/session";
import { getStudio } from "@/lib/studio";

// Everything Memocraft holds about the signed-in person, as one JSON file they can keep. Files themselves are not
// included (they are the creative's own and already on their computer); every file is listed by name and size.
export async function GET() {
  const session = await getSession();
  if (!session) return new Response(null, { status: 401 });
  const user = session.user;

  const [deliveries, sections, files, updates, requests, events, methods, studio] = await Promise.all([
    pool.query(
      `select "id", "title", "clientName", "clientEmail", "message", "status", "createdAt", "updatedAt", "publishedAt", "expiresAt",
              ("passwordHash" is not null) as "passwordProtected"
         from "delivery" where "ownerId" = $1 order by "createdAt"`,
      [user.id],
    ),
    pool.query(
      `select s."id", s."deliveryId", s."title", s."note", s."position"
         from "deliverySection" s join "delivery" d on d."id" = s."deliveryId"
        where d."ownerId" = $1 order by s."position"`,
      [user.id],
    ),
    pool.query(
      `select f."id", f."sectionId", f."name", f."note", f."sizeBytes", f."mimeType", f."createdAt", f."replacedAt"
         from "deliveryFile" f
         join "deliverySection" s on s."id" = f."sectionId"
         join "delivery" d on d."id" = s."deliveryId"
        where d."ownerId" = $1 and f."storageKey" is not null order by f."createdAt"`,
      [user.id],
    ),
    pool.query(
      `select u."deliveryId", u."note", u."createdAt"
         from "deliveryUpdate" u join "delivery" d on d."id" = u."deliveryId"
        where d."ownerId" = $1 order by u."createdAt"`,
      [user.id],
    ),
    pool.query(
      `select r."deliveryId", r."fileName", r."message", r."status", r."createdAt", r."doneAt"
         from "fileRequest" r join "delivery" d on d."id" = r."deliveryId"
        where d."ownerId" = $1 order by r."createdAt"`,
      [user.id],
    ),
    pool.query(
      `select e."deliveryId", e."kind", e."fileName", e."device", e."at"
         from "deliveryEvent" e join "delivery" d on d."id" = e."deliveryId"
        where d."ownerId" = $1 order by e."at"`,
      [user.id],
    ),
    signInMethods(user.id),
    getStudio(user.id),
  ]);
  // What clients said back, without the random browser ids.
  const [approvals, comments, favourites, reminders] = await Promise.all([
    pool.query(
      `select a."deliveryId", a."fileName", a."fileSize", a."name", a."device", a."at"
         from "approval" a join "delivery" d on d."id" = a."deliveryId" where d."ownerId" = $1 order by a."at"`,
      [user.id],
    ),
    pool.query(
      `select c."deliveryId", c."fileId", c."message", c."name", c."fromOwner", c."createdAt", c."resolvedAt"
         from "fileComment" c join "delivery" d on d."id" = c."deliveryId" where d."ownerId" = $1 order by c."createdAt"`,
      [user.id],
    ),
    pool.query(
      `select v."deliveryId", v."fileId", v."at"
         from "fileFavourite" v join "delivery" d on d."id" = v."deliveryId" where d."ownerId" = $1 order by v."at"`,
      [user.id],
    ),
    pool.query(
      `select r."deliveryId", r."n", r."channel", r."createdAt", r."handledAt"
         from "deliveryReminder" r join "delivery" d on d."id" = r."deliveryId" where d."ownerId" = $1 order by r."createdAt"`,
      [user.id],
    ),
  ]);

  const body = {
    exportedAt: new Date().toISOString(),
    account: { name: user.name, email: user.email, emailVerified: user.emailVerified, createdAt: user.createdAt, signInMethods: methods },
    studio: { name: studio?.name ?? null, hasLogo: Boolean(studio?.logoVersion) },
    deliveries: deliveries.rows,
    sections: sections.rows,
    files: files.rows,
    updates: updates.rows,
    fileRequests: requests.rows,
    proofOfDelivery: events.rows,
    approvals: approvals.rows,
    comments: comments.rows,
    hearts: favourites.rows,
    reminders: reminders.rows,
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="memocraft-my-data.json"',
      "Cache-Control": "private, no-store",
    },
  });
}
