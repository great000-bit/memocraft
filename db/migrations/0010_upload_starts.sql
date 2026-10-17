-- One row each time a creative starts an upload, so the server can cap how many uploads (and how many bytes) an
-- account starts in an hour. Without it, a script holding a session could ask for signed upload links without end.
-- Rows older than an hour are no longer read and are deleted the next time the same account starts an upload.

create table if not exists "uploadStart" (
  "userId" text not null references "user" ("id") on delete cascade,
  "at" timestamptz not null default now(),
  "sizeBytes" bigint not null
);

create index if not exists "uploadStart_userId_at_idx" on "uploadStart" ("userId", "at");
