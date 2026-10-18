import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { Pool } from "pg";
import type { PoolClient, PoolConfig } from "pg";
import { emailConfigured, sendInBackground } from "./email";
import { verifyEmailEmail } from "./email-templates";
import { isGooglePicture } from "./avatar";
import { googleConfigured } from "./providers";

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
  constructor(config: PoolConfig) {
    super(config);
    // While a client is checked out the pool stops listening to it, and pg emits "error" when its connection
    // drops (Neon suspending or restarting the database does exactly that). With nobody listening Node treats
    // it as an uncaught exception and the whole serverless process exits, taking every request in flight with
    // it. The query that was running still fails on its own, so this only keeps the process alive.
    this.on("connect", (client) => {
      client.on("error", (error) => console.warn("Database connection dropped:", error.message));
    });
  }

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

// A Google sign-in carries the person's picture in the ID token it saved. It fills the account's picture only
// while none was ever set (null), so a picture someone uploaded or removed is never replaced. This runs at every
// sign-in, which also covers a password account that links Google later. Failing to read it never blocks a sign-in.
function pictureFromIdToken(token: string): string | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { picture?: unknown };
  return typeof claims.picture === "string" && isGooglePicture(claims.picture) ? claims.picture : null;
}

async function fillGooglePicture(userId: string) {
  try {
    const { rows } = await pool.query<{ idToken: string }>(
      `select a."idToken" from "account" a join "user" u on u."id" = a."userId"
        where a."userId" = $1 and a."providerId" = 'google' and a."idToken" is not null and u."image" is null
        limit 1`,
      [userId],
    );
    const picture = rows[0] ? pictureFromIdToken(rows[0].idToken) : null;
    if (picture) await pool.query(`update "user" set "image" = $1, "updatedAt" = now() where "id" = $2 and "image" is null`, [picture, userId]);
  } catch (error) {
    console.warn("Could not read the Google profile picture:", error instanceof Error ? error.message : error);
  }
}

// Preview deployments live on their own hostnames, so they are trusted as origins too.
const trustedOrigins = [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
  .filter((host): host is string => Boolean(host))
  .map((host) => `https://${host}`);

export const auth = betterAuth({
  database: pool,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins,
  // Google is the only way in. Switching passwords off also closes the reset and change-password routes.
  emailAndPassword: { enabled: false },
  // Google tokens (including the Drive backup refresh token) are stored encrypted with BETTER_AUTH_SECRET.
  account: { encryptOAuthTokens: true },
  // Confirming the address is asked for but never blocks signing in: a new creative gets straight to work.
  emailVerification: {
    sendOnSignUp: emailConfigured(),
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url }) => {
      if (!emailConfigured()) return;
      sendInBackground(verifyEmailEmail(user.email, user.name, url));
    },
  },
  socialProviders: googleConfigured()
    ? { google: { clientId: process.env.GOOGLE_CLIENT_ID as string, clientSecret: process.env.GOOGLE_CLIENT_SECRET as string } }
    : {},
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  // Serverless processes do not share memory, so attempts are counted in the database.
  rateLimit: {
    enabled: true,
    storage: "database",
    // Each of these sends an email, so they are held to a few a minute.
    customRules: {
      "/request-password-reset": { window: 60, max: 3 },
      "/send-verification-email": { window: 60, max: 3 },
    },
  },
  databaseHooks: {
    session: { create: { after: async (session) => fillGooglePicture(session.userId) } },
  },
  advanced: { cookiePrefix: "memocraft" },
  plugins: [nextCookies()],
});
