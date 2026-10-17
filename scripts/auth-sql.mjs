// Prints the SQL for the auth tables so it can be reviewed and applied to any database.
// Usage: DATABASE_URL=... BETTER_AUTH_SECRET=... node scripts/auth-sql.mjs [--apply]
import { getMigrations } from "better-auth/db/migration";
import { auth, pool } from "../src/lib/auth.ts";

const { compileMigrations, runMigrations } = await getMigrations(auth.options);
if (process.argv.includes("--apply")) {
  await runMigrations();
  console.log("Applied.");
} else {
  console.log(await compileMigrations());
}
await pool.end();
