-- Memo Explorer: a creative's own file library, apart from any one delivery.
-- "libraryFolder" holds both folders (which nest and hold files) and collections (top-level sets that point at files
-- kept anywhere, like a playlist). A file lives in at most one folder ("folderId" null = the top of My files) and in
-- any number of collections. Uploads follow the delivery files: "pending" holds the upload in progress, and
-- "storageKey" is set once the server has checked the object in storage.
--
-- New tables only, so it can be applied while the app is running.

create table if not exists "libraryFolder" (
  "id" uuid primary key default gen_random_uuid(),
  "ownerId" text not null references "user" ("id") on delete cascade,
  "parentId" uuid references "libraryFolder" ("id") on delete cascade,
  "kind" text not null default 'folder' check ("kind" in ('folder', 'collection')),
  "name" text not null,
  "starred" boolean not null default false,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists "libraryFolder_ownerId_parentId_idx" on "libraryFolder" ("ownerId", "parentId");

create table if not exists "libraryFile" (
  "id" uuid primary key default gen_random_uuid(),
  "ownerId" text not null references "user" ("id") on delete cascade,
  "folderId" uuid references "libraryFolder" ("id") on delete cascade,
  "name" text not null,
  "ext" text,
  "sizeBytes" bigint,
  "mimeType" text,
  "storageKey" text,
  "thumbKey" text,
  "pending" jsonb,
  "starred" boolean not null default false,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists "libraryFile_ownerId_folderId_idx" on "libraryFile" ("ownerId", "folderId");

create table if not exists "libraryCollectionItem" (
  "collectionId" uuid not null references "libraryFolder" ("id") on delete cascade,
  "fileId" uuid not null references "libraryFile" ("id") on delete cascade,
  "addedAt" timestamptz not null default now(),
  primary key ("collectionId", "fileId")
);

create index if not exists "libraryCollectionItem_fileId_idx" on "libraryCollectionItem" ("fileId");
