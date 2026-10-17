-- Link controls. A client link can expire on a date and can ask for a password.
-- "expiresAt" is the moment the link stops working; null means it never expires.
-- "passwordHash" holds a salted scrypt hash, never the password; null means anyone with the link can open it.
-- "passwordFailures" counts wrong guesses in a row; at eight the link refuses guesses until "passwordLockedUntil".
-- Pausing a link needs no column: it is the switch that already exists, "status" going back to 'draft'.
-- Every column is optional or has a default, so this can be applied while the app is running.

alter table "delivery" add column if not exists "expiresAt" timestamptz;
alter table "delivery" add column if not exists "passwordHash" text;
alter table "delivery" add column if not exists "passwordFailures" integer not null default 0;
alter table "delivery" add column if not exists "passwordLockedUntil" timestamptz;
