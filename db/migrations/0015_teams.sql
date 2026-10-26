-- Teams: a creative brings people into their own workspace.
--
-- A team is the owner's account, so there is no team table: everything a teammate does lands on the owner's
-- deliveries, library and storage, exactly as if the owner had done it. "teamMember" says who may work there and how:
-- an editor can do everything with the work, a viewer can look at it and change nothing. Only the owner manages
-- people, the studio, billing and the account itself.
--
-- An invite is for one email address. The link carries a random token; only its SHA-256 is kept, so the table
-- alone cannot be used to join. Accepting turns the invite into a "teamMember" row and deletes the invite.
--
-- New tables only, so it can be applied while the app is running.

create table if not exists "teamMember" (
  "ownerId" text not null references "user" ("id") on delete cascade,
  "userId" text not null references "user" ("id") on delete cascade,
  "role" text not null check ("role" in ('editor', 'viewer')),
  "createdAt" timestamptz not null default now(),
  primary key ("ownerId", "userId"),
  check ("ownerId" <> "userId")
);

create index if not exists "teamMember_userId_idx" on "teamMember" ("userId");

create table if not exists "teamInvite" (
  "id" uuid primary key default gen_random_uuid(),
  "ownerId" text not null references "user" ("id") on delete cascade,
  "email" text not null,
  "role" text not null check ("role" in ('editor', 'viewer')),
  "tokenHash" text not null unique,
  "createdAt" timestamptz not null default now(),
  "expiresAt" timestamptz not null
);

create unique index if not exists "teamInvite_ownerId_email_idx" on "teamInvite" ("ownerId", lower("email"));
