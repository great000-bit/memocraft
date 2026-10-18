-- AI enhance: a sharper, larger copy of a photo, made by an upscaling model on Replicate.
--
-- The original is never changed. "enhancedKey" points to the enhanced copy in storage and "enhancedBytes" is its size
-- (counted in the account's storage). "enhanceJob" holds the run in progress, or its error, until it is done.
-- "enhanceRun" keeps one row per run that was started, so the monthly allowance counts runs even after the photo or
-- its enhanced copy is removed.
--
-- New nullable columns and a new table only, so it can be applied while the app is running.

alter table "deliveryFile"
  add column if not exists "enhancedKey" text,
  add column if not exists "enhancedBytes" bigint,
  add column if not exists "enhanceJob" jsonb;

create table if not exists "enhanceRun" (
  "id" uuid primary key default gen_random_uuid(),
  "userId" text not null references "user" ("id") on delete cascade,
  "fileId" uuid,
  "predictionId" text,
  "at" timestamptz not null default now()
);

create index if not exists "enhanceRun_user_at_idx" on "enhanceRun" ("userId", "at" desc);
