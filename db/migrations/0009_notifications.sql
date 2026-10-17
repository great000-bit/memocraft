-- Phone notifications and the Notifications page.
-- "pushSubscription" is one row per device where the creative switched phone notifications on: the push service's
-- address for that device and the keys that encrypt messages to it. Nothing about clients is stored here. A device
-- that turns them off, or that the push service says is gone, has its row deleted.
-- "noticeSeen" is when the creative last looked at the Notifications page; anything newer shows as unread.

create table if not exists "pushSubscription" (
  "id" uuid primary key default gen_random_uuid(),
  "userId" text not null references "user" ("id") on delete cascade,
  "endpoint" text not null unique,
  "p256dh" text not null,
  "auth" text not null,
  "device" text not null default 'Unknown device',
  "createdAt" timestamptz not null default now(),
  "lastUsedAt" timestamptz
);

create index if not exists "pushSubscription_userId_idx" on "pushSubscription" ("userId");

create table if not exists "noticeSeen" (
  "userId" text primary key references "user" ("id") on delete cascade,
  "seenAt" timestamptz not null default now()
);
