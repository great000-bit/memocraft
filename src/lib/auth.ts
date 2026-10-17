import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { Pool } from "pg";

// One pool per server process. In dev the module reloads, so the pool is kept on globalThis.
const globalForPool = globalThis as unknown as { memocraftPool?: Pool };

export const pool =
  globalForPool.memocraftPool ??
  new Pool({ connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 10_000 });

if (process.env.NODE_ENV !== "production") globalForPool.memocraftPool = pool;

// Preview deployments live on their own hostnames, so they are trusted as origins too.
const trustedOrigins = [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
  .filter((host): host is string => Boolean(host))
  .map((host) => `https://${host}`);

export const auth = betterAuth({
  database: pool,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  // Serverless processes do not share memory, so attempts are counted in the database.
  rateLimit: { enabled: true, storage: "database" },
  advanced: { cookiePrefix: "memocraft" },
  plugins: [nextCookies()],
});
