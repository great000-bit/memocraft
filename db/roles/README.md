# Least-privilege database role

Today the app connects to Neon as `neondb_owner`, which can also create, change and drop tables. `app_role.sql` sets
up `memocraft_app`, a login that can only read and write rows in Memocraft's tables. Migrations keep running as the
owner. Tested locally on Postgres 16: sign-up, uploads, the hourly upload limit, deleting a delivery and deleting an
account all work as `memocraft_app`, and creating, altering or dropping a table is refused.

## Switching production over

Nothing here changes production until step 4. Steps 1 to 3 are safe to run at any time.

1. In Neon (project sweet-cherry-75476071, branch `main`), add a role named `memocraft_app`. Neon shows its password
   once; keep it somewhere private.
2. Run the grants as the owner: `psql "<owner connection string>" -f db/roles/app_role.sql` (or paste the file into
   the Neon SQL editor, which runs as the owner).
3. Check the role with its own connection string:
   `psql "<memocraft_app connection string>" -c 'select count(*) from "delivery"'` answers, and
   `psql "<memocraft_app connection string>" -c 'create table x (a int)'` says permission denied.
4. In Vercel (project memocraft, Production), set `DATABASE_URL` to the `memocraft_app` connection string (pooled
   host, `sslmode=require`) and redeploy.
5. Open `/api/health`, sign in, open a delivery and upload a file. Check runtime errors for `permission denied`.

To undo: put the previous `DATABASE_URL` back in Vercel and redeploy. The role and its grants can stay.

New migrations still run as the owner. `app_role.sql` sets default privileges, so tables the owner creates later are
readable and writable by `memocraft_app` without another grant.
