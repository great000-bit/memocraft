import { pool } from "./auth";
import { emailConfigured, sendInBackground } from "./email";
import { reminderEmail } from "./email-templates";
import { notifyOwner } from "./push";

// Gentle follow-ups. When nobody has opened a live link after "reminderDays" days, a reminder comes due; a second
// one after twice that, and never more. Once the client opens the link, nothing more is sent.
//
// With email set up and the client's address typed in, Memocraft emails the client for the creative. Otherwise the
// creative gets the reminder in Notifications (and on their phone) with a message ready to copy or send on WhatsApp.

export const reminderChoices = [2, 3, 5, 7] as const;
export const maxReminders = 2;

// A reminder missed by more than a week (the app was down, reminders were just switched on for an old link) is
// skipped, so nobody gets a nudge about something from a month ago.
const staleAfter = "7 days";

type Raised = {
  deliveryId: string;
  n: number;
  channel: "email" | "app";
  clientEmail: string | null;
  clientName: string | null;
  title: string;
  slug: string;
  senderName: string;
  customDomain: string | null;
};

// Records every reminder that has come due, for one creative or (from the daily job) for everyone, and sends it.
// The unique index on ("deliveryId", "n") means two callers at once still raise each reminder only once.
export async function raiseDueReminders(ownerId: string | null = null): Promise<number> {
  const canEmail = emailConfigured() && Boolean(process.env.BETTER_AUTH_URL);
  const { rows } = await pool.query<Raised>(
    `with due as (
       select distinct on (d."id") d."id", n.n, d."clientEmail"
         from "delivery" d
         cross join (values (1), (2)) as n(n)
        where d."status" = 'published' and d."publishedAt" is not null and d."reminderDays" is not null
          and (d."expiresAt" is null or d."expiresAt" > now())
          and ($1::text is null or d."ownerId" = $1)
          and d."publishedAt" + make_interval(days => d."reminderDays" * n.n) <= now()
          and d."publishedAt" + make_interval(days => d."reminderDays" * n.n) > now() - interval '${staleAfter}'
          and not exists (select 1 from "deliveryEvent" e where e."deliveryId" = d."id" and e."kind" = 'open')
          and not exists (select 1 from "deliveryReminder" r where r."deliveryId" = d."id" and r."n" >= n.n)
        order by d."id", n.n desc
     ), raised as (
       insert into "deliveryReminder" ("deliveryId", "n", "channel", "handledAt")
       select due."id", due.n,
              case when $2::boolean and due."clientEmail" is not null then 'email' else 'app' end,
              case when $2::boolean and due."clientEmail" is not null then now() end
         from due
       on conflict ("deliveryId", "n") do nothing
       returning "deliveryId", "n", "channel"
     )
     select r."deliveryId", r."n", r."channel", d."clientEmail", d."clientName", d."title", d."slug",
            coalesce(st."name", u."name") as "senderName",
            case when ap."brandingTools" and st."domainStatus" = 'active' then lower(st."customDomain") end as "customDomain"
       from raised r
       join "delivery" d on d."id" = r."deliveryId"
       join "user" u on u."id" = d."ownerId"
       left join "studio" st on st."userId" = d."ownerId"
       left join "accountPlan" ap on ap."userId" = d."ownerId"`,
    [ownerId, canEmail],
  );
  for (const row of rows) {
    if (row.channel === "email" && row.clientEmail) {
      sendInBackground(
        reminderEmail({
          to: row.clientEmail,
          clientName: row.clientName,
          senderName: row.senderName,
          deliveryTitle: row.title,
          url: clientLink(row.slug, row.customDomain),
        }),
      );
    } else {
      notifyOwner(row.deliveryId, "reminder");
    }
  }
  return rows.length;
}

export function clientLink(slug: string, customDomain: string | null): string {
  const base = customDomain ? `https://${customDomain}` : (process.env.BETTER_AUTH_URL ?? "https://memocraft-alpha.vercel.app");
  return new URL(`/d/${slug}`, base).toString();
}

// The words the creative sends themselves. Short enough for a text message.
export function reminderMessage(options: { clientName: string | null; title: string; senderName: string; url: string }): string {
  const first = options.clientName?.trim().split(/\s+/)[0];
  return [
    `Hi${first ? ` ${first}` : ""}, a quick reminder that your files for "${options.title}" are ready.`,
    `You can open and save them here: ${options.url}`,
    `Thanks, ${options.senderName}`,
  ].join("\n");
}

export type ReminderState = {
  // When the next reminder comes due, if one will.
  nextAt: Date | null;
  sent: { n: number; channel: "email" | "app"; at: Date; handled: boolean }[];
  opened: boolean;
};

export async function getReminderState(deliveryId: string, ownerId: string): Promise<ReminderState> {
  const { rows } = await pool.query<{
    publishedAt: Date | null;
    reminderDays: number | null;
    status: string;
    opened: boolean;
  }>(
    `select d."publishedAt", d."reminderDays", d."status",
            exists (select 1 from "deliveryEvent" e where e."deliveryId" = d."id" and e."kind" = 'open') as "opened"
       from "delivery" d where d."id" = $1 and d."ownerId" = $2`,
    [deliveryId, ownerId],
  );
  const delivery = rows[0];
  if (!delivery) return { nextAt: null, sent: [], opened: false };
  const sent = await pool.query<{ n: number; channel: "email" | "app"; createdAt: Date; handledAt: Date | null }>(
    `select "n", "channel", "createdAt", "handledAt" from "deliveryReminder" where "deliveryId" = $1 order by "n"`,
    [deliveryId],
  );
  const done = sent.rows.reduce((most, row) => Math.max(most, row.n), 0);
  let nextAt: Date | null = null;
  if (delivery.status === "published" && delivery.publishedAt && delivery.reminderDays && !delivery.opened && done < maxReminders) {
    nextAt = new Date(delivery.publishedAt.getTime() + delivery.reminderDays * (done + 1) * 24 * 3600 * 1000);
  }
  return {
    nextAt,
    sent: sent.rows.map((row) => ({ n: row.n, channel: row.channel, at: row.createdAt, handled: row.handledAt !== null })),
    opened: delivery.opened,
  };
}
