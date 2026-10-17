-- The admin console (/admin), which only the addresses in ADMIN_EMAILS can open.
--
-- "adminAudit" records each time an admin looks at one person's account, so looking is never silent. "adminId" and
-- "targetUserId" are plain text, not references: the record stays after either account is deleted.
-- The index on "deliveryEvent" ("at") lets the app-wide activity feed read the newest opens and downloads without
-- sorting the whole table.
--
-- New table and a new index only, so it can be applied while the app is running.

create table if not exists "adminAudit" (
  "id" uuid primary key default gen_random_uuid(),
  "adminId" text not null,
  "adminEmail" text not null,
  "action" text not null,
  "targetUserId" text,
  "at" timestamptz not null default now()
);

create index if not exists "adminAudit_at_idx" on "adminAudit" ("at" desc);
create index if not exists "deliveryEvent_at_idx" on "deliveryEvent" ("at" desc);
