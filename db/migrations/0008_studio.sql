-- A creative's studio: the name and logo that lead their client pages ("Your name comes first").
--
-- One row per person, created the first time they set either. "name" null means the client page uses the person's
-- own name. The logo is a PNG in file storage at studio-logos/<userId>; "logoVersion" is null when there is none and
-- otherwise changes with every upload, so the address the client page uses picks up a new logo straight away.
-- "logoWidth" and "logoHeight" are the stored picture's size, so the page can hold its space before it loads.
--
-- New table only, so it can be applied while the app is running.

create table if not exists "studio" (
  "userId" text primary key references "user" ("id") on delete cascade,
  "name" text,
  "logoVersion" bigint,
  "logoWidth" integer,
  "logoHeight" integer,
  "updatedAt" timestamptz not null default now()
);
