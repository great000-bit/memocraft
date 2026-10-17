-- What a client can say back on a delivery page, reminders for clients who have not opened yet, and the switches for
-- a paid "your own branding" plan. Clients still never sign in.
--
-- "clientKey" is a random id the client's browser makes and keeps in its own storage. It lets one browser take back
-- its own heart and keeps a double tap from counting twice. It is never tied to a person, an IP address or a device
-- fingerprint. "device" is the same short label proof of delivery uses (iPhone, Windows).
--
-- "approval": the client tapped Approve on one file ("fileId" set) or on the whole delivery ("fileId" null). Rows are
-- never edited, so each one is a dated receipt. "name" is what the client typed, if anything. "fileName" and
-- "fileSize" keep the file as it was when approved, so the receipt still reads right after a rename or a new version.
-- "fileVersionAt" is the file's "replacedAt" at the time: an approval older than the file's current version no
-- longer counts on the page.
--
-- "fileFavourite": a heart on a file, one per browser. Taking it back deletes the row.
--
-- "fileComment": a note on a file, optionally pinned to a spot on its picture ("x", "y" from 0 to 1 across and down).
-- "fromOwner" marks the creative's reply, and "parentId" the client note it answers. "resolvedAt" is set when the
-- creative marks a note done.
--
-- "deliveryReminder": a reminder for a delivery nobody has opened, at most two per delivery. "channel" says whether
-- Memocraft emailed the client ('email') or asked the creative to send it themselves ('app'). "handledAt" is when
-- the creative sent or dismissed an 'app' reminder.
-- "delivery"."clientEmail" is typed by the creative, optional, and used only to send those reminders.
-- "delivery"."reminderDays" is how many days to wait before each reminder; null switches reminders off.
--
-- "accountPlan": what an account may use beyond the free product. "brandingTools" lets it hide "Sent with Memocraft"
-- and connect its own web address. Off for everyone until plans exist; turned on by hand.
-- "studio"."hideBranding" is the creative's own switch; it only has effect while "brandingTools" is on.
-- "studio"."customDomain" is a host such as files.studio.com; "domainStatus" is 'pending' until it is set up and
-- answers, then 'active'.
--
-- Everything is new or has a default, so this can be applied while the app is running.

create table if not exists "approval" (
  "id" uuid primary key default gen_random_uuid(),
  "deliveryId" uuid not null references "delivery" ("id") on delete cascade,
  "fileId" uuid references "deliveryFile" ("id") on delete set null,
  "fileName" text,
  "fileSize" bigint,
  "fileVersionAt" timestamptz,
  "name" text,
  "clientKey" text,
  "device" text not null default 'Unknown device',
  "at" timestamptz not null default now()
);

create index if not exists "approval_deliveryId_at_idx" on "approval" ("deliveryId", "at" desc);

create table if not exists "fileFavourite" (
  "fileId" uuid not null references "deliveryFile" ("id") on delete cascade,
  "deliveryId" uuid not null references "delivery" ("id") on delete cascade,
  "clientKey" text not null,
  "at" timestamptz not null default now(),
  primary key ("fileId", "clientKey")
);

create index if not exists "fileFavourite_deliveryId_at_idx" on "fileFavourite" ("deliveryId", "at" desc);

create table if not exists "fileComment" (
  "id" uuid primary key default gen_random_uuid(),
  "deliveryId" uuid not null references "delivery" ("id") on delete cascade,
  "fileId" uuid not null references "deliveryFile" ("id") on delete cascade,
  "message" text not null,
  "x" real check ("x" between 0 and 1),
  "y" real check ("y" between 0 and 1),
  "name" text,
  "clientKey" text,
  "fromOwner" boolean not null default false,
  "parentId" uuid references "fileComment" ("id") on delete cascade,
  "createdAt" timestamptz not null default now(),
  "resolvedAt" timestamptz
);

create index if not exists "fileComment_deliveryId_idx" on "fileComment" ("deliveryId", "createdAt");

alter table "delivery" add column if not exists "clientEmail" text;
alter table "delivery" add column if not exists "reminderDays" integer default 3 check ("reminderDays" between 1 and 30);

create table if not exists "deliveryReminder" (
  "id" uuid primary key default gen_random_uuid(),
  "deliveryId" uuid not null references "delivery" ("id") on delete cascade,
  "n" integer not null check ("n" in (1, 2)),
  "channel" text not null check ("channel" in ('email', 'app')),
  "createdAt" timestamptz not null default now(),
  "handledAt" timestamptz,
  unique ("deliveryId", "n")
);

create table if not exists "accountPlan" (
  "userId" text primary key references "user" ("id") on delete cascade,
  "brandingTools" boolean not null default false,
  "updatedAt" timestamptz not null default now()
);

alter table "studio" add column if not exists "hideBranding" boolean not null default false;
alter table "studio" add column if not exists "customDomain" text;
alter table "studio" add column if not exists "domainStatus" text check ("domainStatus" in ('pending', 'active'));
create unique index if not exists "studio_customDomain_idx" on "studio" (lower("customDomain")) where "customDomain" is not null;
