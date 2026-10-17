-- Deliveries: a delivery has sections, and sections have files. Files carry a note saying what they are for.
-- Clients open a delivery by its slug, so the slug is the only secret and must stay unguessable.

create table if not exists "delivery" (
  "id" uuid primary key default gen_random_uuid(),
  "ownerId" text not null references "user" ("id") on delete cascade,
  "title" text not null,
  "clientName" text,
  "message" text,
  "slug" text not null unique,
  "status" text not null default 'draft' check ("status" in ('draft', 'published')),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "publishedAt" timestamptz
);

create index if not exists "delivery_ownerId_updatedAt_idx" on "delivery" ("ownerId", "updatedAt" desc);

create table if not exists "deliverySection" (
  "id" uuid primary key default gen_random_uuid(),
  "deliveryId" uuid not null references "delivery" ("id") on delete cascade,
  "title" text not null,
  "note" text,
  "position" integer not null default 0
);

create index if not exists "deliverySection_deliveryId_position_idx" on "deliverySection" ("deliveryId", "position");

-- storageKey stays null until uploads exist; a file with no storageKey is a labelled placeholder.
create table if not exists "deliveryFile" (
  "id" uuid primary key default gen_random_uuid(),
  "sectionId" uuid not null references "deliverySection" ("id") on delete cascade,
  "name" text not null,
  "note" text,
  "sizeBytes" bigint,
  "mimeType" text,
  "storageKey" text,
  "position" integer not null default 0,
  "createdAt" timestamptz not null default now()
);

create index if not exists "deliveryFile_sectionId_position_idx" on "deliveryFile" ("sectionId", "position");
