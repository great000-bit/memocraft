-- Optional "Back up to my Google Drive". A creative who turns it on lets Memocraft copy their files into a
-- "Memocraft" folder in their own Drive, using only the drive.file permission (files the app itself creates).
-- Client pages keep serving from storage; Drive is the creative's own extra copy.
--
-- "driveBackup": one row per person who has ever turned it on. "enabled" is the switch; "lastError" is shown
-- in Settings when Google refuses (token revoked, Drive full).
-- "driveBackupFolder": the Drive folder made for each delivery.
-- "driveBackupFile": one copy job per file. "sessionUri" and "sentBytes" let a large upload resume across
-- requests; "lockedUntil" keeps two requests from copying the same file at once.
--
-- New tables only, so it can be applied while the app is running.

create table if not exists "driveBackup" (
  "userId" text primary key references "user" ("id") on delete cascade,
  "enabled" boolean not null default true,
  "folderId" text,
  "lastError" text,
  "updatedAt" timestamptz not null default now()
);

create table if not exists "driveBackupFolder" (
  "deliveryId" uuid primary key references "delivery" ("id") on delete cascade,
  "folderId" text not null
);

create table if not exists "driveBackupFile" (
  "fileId" uuid primary key references "deliveryFile" ("id") on delete cascade,
  "userId" text not null references "user" ("id") on delete cascade,
  "storageKey" text not null,
  "status" text not null default 'pending' check ("status" in ('pending', 'done', 'failed')),
  "driveFileId" text,
  "sessionUri" text,
  "sentBytes" bigint not null default 0,
  "attempts" integer not null default 0,
  "error" text,
  "lockedUntil" timestamptz,
  "updatedAt" timestamptz not null default now()
);

create index if not exists "driveBackupFile_user_status_idx" on "driveBackupFile" ("userId", "status");
