-- A least-privilege login for the running app: it can read and write rows in Memocraft's tables and nothing else.
-- It cannot create, alter or drop tables, create roles or databases, or read other schemas. Migrations keep running
-- as the owner role (neondb_owner on Neon), which stays out of the app's environment.
--
-- Run as the owner role, after the role "memocraft_app" exists with a password (on Neon, create it in the console
-- or API so Neon stores the password; locally: create role memocraft_app login password '...';):
--   psql "$OWNER_DATABASE_URL" -f db/roles/app_role.sql
-- Safe to run again. See db/roles/README.md for switching production over.

do $$
begin
  execute format('grant connect on database %I to memocraft_app', current_database());
end
$$;

-- Nothing is created by the app at runtime.
revoke create on schema public from memocraft_app;
grant usage on schema public to memocraft_app;

grant select, insert, update, delete on all tables in schema public to memocraft_app;
grant usage, select on all sequences in schema public to memocraft_app;

-- Tables a later migration adds (run by this same owner role) get the same rights without another grant.
alter default privileges in schema public grant select, insert, update, delete on tables to memocraft_app;
alter default privileges in schema public grant usage, select on sequences to memocraft_app;

-- A runaway query from the app is stopped rather than holding a connection on a small database.
alter role memocraft_app set statement_timeout = '30s';
