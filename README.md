# Memocraft

Creative delivery and client collaboration: one link per delivery, files that explain themselves, proof of delivery, and downloads made for the client's phone.

## Stack

- Next.js (App Router) on Vercel
- Neon Postgres (`pg`) with Better Auth for email and password accounts
- Cloudflare R2 for file storage (any S3-compatible store works)

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
| `STORAGE_ENDPOINT` | S3 endpoint. For R2: `https://<account id>.r2.cloudflarestorage.com`. |
| `STORAGE_BUCKET` | Bucket name. |
| `STORAGE_ACCESS_KEY_ID` / `STORAGE_SECRET_ACCESS_KEY` | An R2 API token's S3 credentials, with Object Read & Write on the bucket. |
| `STORAGE_REGION` | Optional. Defaults to `auto`, which is what R2 wants. |
| `STORAGE_FORCE_PATH_STYLE` | Optional. Set `true` for a local S3 test server. |
| `RESEND_API_KEY` / `EMAIL_FROM` | Optional. Switch on email: password reset and the "confirm your email" message. `EMAIL_FROM` is like `Memocraft <hello@your-domain>` and the domain must be verified in Resend. `RESEND_API_URL` points at a different server in tests. |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Optional. Switch on phone notifications (Web Push). Make a pair with `npx web-push generate-vapid-keys`. `VAPID_SUBJECT` is optional (defaults to the site's https address). Changing the keys signs every device out of notifications. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional. Switch on "Continue with Google". In Google Cloud the authorised redirect URI is `<BETTER_AUTH_URL>/api/auth/callback/google`. |

Without the `STORAGE_*` variables the app still runs: uploads are switched off and the editor says so. Files go from the browser straight to the bucket with signed URLs, so the bucket needs a CORS rule allowing `PUT` from the app's address. "Save to phone" on the client page reads each file in the browser before opening the phone's share sheet, so the rule allows `GET` too, for example `[{"AllowedOrigins": ["https://memocraft-alpha.vercel.app"], "AllowedMethods": ["GET", "PUT"], "AllowedHeaders": ["*"], "MaxAgeSeconds": 3600}]`. Without `GET` that button says to use Download instead; plain Download links are redirects to short-lived signed links and need no CORS rule.

Profile pictures: a Google sign-in fills `user.image` with the Google picture while it has never been set (`null`); an uploaded picture is a squared 512 px JPEG kept at `avatars/<user id>` in the same bucket and served by `/api/avatar/<user id>` to its owner only, so it needs no CORS rule. Removing a picture stores an empty string, which a later Google sign-in does not fill again. Settings has password change, "log out other devices", a JSON export of the account's data (`/api/account/export`) and account deletion: one `delete from "user"` cascades through every table, then the account's storage objects are removed.

The tables are in `db/migrations`, numbered in the order to apply them: `0001_auth.sql` (accounts and sessions) and `0002_deliveries.sql` (deliveries, sections and files) and `0003_file_uploads.sql` (upload state on files) and `0004_delivery_events.sql` (proof of delivery: opens and downloads) and `0005_file_thumbnails.sql` (a preview picture beside each uploaded image) and `0006_link_controls.sql` (password and end date on a link) and `0007_updates_versions_requests.sql` (update notes, earlier versions of a replaced file, and client requests) and `0008_studio.sql` (studio name and logo) and `0009_notifications.sql` (devices with phone notifications on, and when the Notifications page was last read) and `0010_upload_starts.sql` (uploads each account started in the last hour, for the hourly upload limit). Apply each to a new database with `psql "$DATABASE_URL" -f db/migrations/0001_auth.sql`. `node scripts/auth-sql.mjs` prints the SQL the installed Better Auth version expects, to check for drift after an upgrade. `db/roles/README.md` sets up a least-privilege login for the app. `/api/health` reports whether the app can reach its database and its file storage.

Email and Google sign-in are off until their variables are set, and the screens that need them stay hidden meanwhile. The log-in, sign-up and forgot-password pages are built ahead of time, so after changing these variables, redeploy.

The app installs to a phone's Home Screen (`src/app/manifest.ts`, icons in `public/icons`). `public/sw.js` only shows phone notifications and caches nothing. iPhones allow web notifications only once the app is on the Home Screen (iOS 16.4+); the Notifications page walks through it.

The workspace opens dark; the light/dark choice is per device (`localStorage` `mc-theme`). Dark values for every token sit on `.app-scope:not([data-theme="light"])` in `globals.css`.

Design tokens live in `src/app/globals.css` and mirror the Memocraft Design System. The logo in `src/components/Logo.tsx` is outlined from Godber (licensed for logo use); never load Godber as a web font.
