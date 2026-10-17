import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { Pool } from "pg";
import type { PoolClient } from "pg";

type PendingItem = {
  callback: (error: Error | undefined, client?: PoolClient, release?: () => void) => void;
  timedOut?: boolean;
};

const retryConnectAfterMs = 400;

// Neon wakes a suspended database on the first connection, and that handshake can time out ("Authentication
// timed out"). A connection that failed before running anything is safe to open again, so every new connection
// gets one more try. Because it sits in the pool it covers all queries, including the ones Better Auth makes,
// and a client opening a link never sees the hiccup. A second failure is a real outage and still surfaces.
// `newClient` is internal to pg-pool; if a future version renames it this override is simply never called.
class WakingPool extends Pool {
  newClient(pendingItem: PendingItem) {
    const open = (Pool.prototype as unknown as { newClient(item: PendingItem): void }).newClient;
    const callback = pendingItem.callback;
    let retried = false;
    pendingItem.callback = (error, client, release) => {
      if (error && !retried && !pendingItem.timedOut) {
        retried = true;
        console.warn("Database connection failed, trying once more:", error.message);
        setTimeout(() => open.call(this, pendingItem), retryConnectAfterMs);
        return;
      }
      callback(error, client, release);
    };
    open.call(this, pendingItem);
  }
}

// One pool per server process. In dev the module reloads, so the pool is kept on globalThis.
const globalForPool = globalThis as unknown as { memocraftPool?: Pool };

export const pool =
  globalForPool.memocraftPool ??
  new WakingPool({ connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 10_000 });

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
