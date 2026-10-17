# Memocraft

Creative delivery and client collaboration: one link per delivery, files that explain themselves, proof of delivery, and downloads made for the client's phone.

## Stack

- Next.js (App Router) on Vercel
- Neon Postgres with Auth.js (planned)
- Cloudflare R2 for file storage (planned)

## Develop

```bash
npm install
npm run dev
```

Design tokens live in `src/app/globals.css` and mirror the Memocraft Design System. The logo in `src/components/Logo.tsx` is outlined from Godber (licensed for logo use); never load Godber as a web font.
