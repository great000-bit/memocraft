# Memocraft

Creative delivery and client collaboration: one link per delivery, files that explain themselves, proof of delivery, and downloads made for the client's phone.

## Stack

- Next.js (App Router) on Vercel
- Neon Postgres (`pg`) with Better Auth for email and password accounts
- Cloudflare R2 for file storage (planned)

## Develop

```bash
npm install
npm run dev
```

Set these in `.env.local` (never commit it):

| Variable | What it is |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. Neon in production; any Postgres locally. |
| `BETTER_AUTH_SECRET` | Random string, at least 32 characters, that signs login sessions. |
| `BETTER_AUTH_URL` | The app's public address, such as `http://localhost:3000`. |

The auth tables are in `db/migrations/0001_auth.sql`. Apply it to a new database with `psql "$DATABASE_URL" -f db/migrations/0001_auth.sql`. `node scripts/auth-sql.mjs` prints the SQL the installed Better Auth version expects, to check for drift after an upgrade. `/api/health` reports whether the app can reach its database.

Design tokens live in `src/app/globals.css` and mirror the Memocraft Design System. The logo in `src/components/Logo.tsx` is outlined from Godber (licensed for logo use); never load Godber as a web font.
