"use server";

import { verifyPassword } from "better-auth/crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, pool } from "./auth";
import { avatarKey } from "./profile";
import { requireUser } from "./session";
import { deleteObjects, removeStored, type PendingUpload } from "./storage";

export type AccountResult = { ok: true } | { ok: false; error: string };

const fail = (error: string) => ({ ok: false as const, error });

type StoredFile = { storageKey: string | null; thumbKey: string | null; pending: PendingUpload | null };
type StoredVersion = { storageKey: string; thumbKey: string | null };

// Deletes the signed-in person's account for good. The database does the heavy lifting: every table that holds
// their data points at the user row with "on delete cascade" (sessions, sign-in methods, deliveries and, through
// them, sections, files, versions, updates, requests and proof of delivery). What the database cannot reach is the
// file storage, so the object keys are collected first and removed after the rows are gone. A key that cannot be
// removed is logged and left behind; it can no longer be reached from anywhere.
export async function deleteAccount(_previous: AccountResult | null, formData: FormData): Promise<AccountResult> {
  const user = await requireUser();

  const typed = String(formData.get("confirm") ?? "").trim().toLowerCase();
  if (typed !== user.email.trim().toLowerCase()) return fail("Type your email address exactly as shown to confirm.");

  // Anyone holding a signed-in browser could otherwise delete everything, so a password account also asks for the password.
  const credential = await pool.query<{ password: string | null }>(
    `select "password" from "account" where "userId" = $1 and "providerId" = 'credential' limit 1`,
    [user.id],
  );
  if (credential.rows[0]) {
    const password = String(formData.get("password") ?? "");
    const hash = credential.rows[0].password;
    if (!password || !hash || !(await verifyPassword({ hash, password }))) return fail("That password is not right.");
  }

  const files = await pool.query<StoredFile>(
    `select f."storageKey", f."thumbKey", f."pending"
       from "deliveryFile" f
       join "deliverySection" s on s."id" = f."sectionId"
       join "delivery" d on d."id" = s."deliveryId"
      where d."ownerId" = $1`,
    [user.id],
  );
  const versions = await pool.query<StoredVersion>(
    `select v."storageKey", v."thumbKey"
       from "deliveryFileVersion" v
       join "deliveryFile" f on f."id" = v."fileId"
       join "deliverySection" s on s."id" = f."sectionId"
       join "delivery" d on d."id" = s."deliveryId"
      where d."ownerId" = $1`,
    [user.id],
  );

  // One statement, so either everything goes or nothing does. Leftover reset and verification links (they are
  // keyed by the email address or hold the user id) go with it.
  try {
    await pool.query(
      `with gone as (delete from "user" where "id" = $1 returning "id")
       delete from "verification" where "identifier" = $2 or "value" = $1`,
      [user.id, user.email],
    );
  } catch (error) {
    console.error("Could not delete an account", error);
    return fail("We could not delete your account. Nothing was changed. Try again.");
  }

  await removeStored([
    ...files.rows,
    ...versions.rows.map((version) => ({ storageKey: version.storageKey, thumbKey: version.thumbKey, pending: null })),
  ]);
  await deleteObjects([avatarKey(user.id)]);

  // The session row is already gone; this clears the cookie so the browser stops sending it.
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch (error) {
    console.warn("Could not clear the session cookie after deleting an account:", error instanceof Error ? error.message : error);
  }
  redirect("/goodbye");
}
