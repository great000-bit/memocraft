-- Proof of delivery. One row each time a client opens a delivery link or starts a download.
-- "visit" is a random id the client's browser makes for one tab session; it keeps a reload from counting as a new
-- open and is never tied to a person. "device" is a short label such as iPhone or Windows; the raw user agent and
-- the IP address are not stored. "fileName" keeps the label as it was at the time, so the record survives a rename
-- or a removed file.

create table if not exists "deliveryEvent" (
  "id" uuid primary key default gen_random_uuid(),
  "deliveryId" uuid not null references "delivery" ("id") on delete cascade,
  "kind" text not null check ("kind" in ('open', 'download')),
  "fileId" uuid references "deliveryFile" ("id") on delete set null,
  "fileName" text,
  "visit" text,
  "device" text not null default 'Unknown device',
  "at" timestamptz not null default now()
);

create index if not exists "deliveryEvent_deliveryId_at_idx" on "deliveryEvent" ("deliveryId", "at" desc);
create index if not exists "deliveryEvent_fileId_idx" on "deliveryEvent" ("fileId") where "fileId" is not null;
create unique index if not exists "deliveryEvent_open_visit_idx"
  on "deliveryEvent" ("deliveryId", "visit") where "kind" = 'open' and "visit" is not null;
