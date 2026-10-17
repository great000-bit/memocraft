-- Three things a creative does after sending a link.
--
-- "deliveryUpdate": a short note saying what changed, shown to the client above the files ("Updated 18 Oct").
-- "deliveryFile"."replacedAt": when a file was last swapped for a new one, so the client page can mark it Updated.
-- "deliveryFileVersion": the file that was replaced, kept in storage so nothing is overwritten by mistake. It
--   counts toward the owner's storage and is removed with its file.
-- "fileRequest": something a client asked for from the client page ("Can I have the PNG?"). The owner marks it
--   done. "fileName" keeps the file's label as it was when asked, so the request still reads right after a rename.
--
-- Everything here is new or optional, so it can be applied while the app is running.

alter table "deliveryFile" add column if not exists "replacedAt" timestamptz;

create table if not exists "deliveryUpdate" (
  "id" uuid primary key default gen_random_uuid(),
  "deliveryId" uuid not null references "delivery" ("id") on delete cascade,
  "note" text not null,
  "createdAt" timestamptz not null default now()
);

create index if not exists "deliveryUpdate_deliveryId_idx" on "deliveryUpdate" ("deliveryId", "createdAt" desc);

create table if not exists "deliveryFileVersion" (
  "id" uuid primary key default gen_random_uuid(),
  "fileId" uuid not null references "deliveryFile" ("id") on delete cascade,
  "storageKey" text not null,
  "thumbKey" text,
  "sizeBytes" bigint not null,
  "mimeType" text,
  "ext" text,
  "replacedAt" timestamptz not null default now()
);

create index if not exists "deliveryFileVersion_fileId_idx" on "deliveryFileVersion" ("fileId", "replacedAt" desc);

create table if not exists "fileRequest" (
  "id" uuid primary key default gen_random_uuid(),
  "deliveryId" uuid not null references "delivery" ("id") on delete cascade,
  "fileId" uuid references "deliveryFile" ("id") on delete set null,
  "fileName" text,
  "message" text not null,
  "status" text not null default 'open' check ("status" in ('open', 'done')),
  "createdAt" timestamptz not null default now(),
  "doneAt" timestamptz
);

create index if not exists "fileRequest_deliveryId_idx" on "fileRequest" ("deliveryId", "status", "createdAt" desc);
