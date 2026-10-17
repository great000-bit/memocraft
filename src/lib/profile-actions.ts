"use server";

import { revalidatePath } from "next/cache";
import { pool } from "./auth";
import { photoRules } from "./avatar";
import { avatarKey, sniffImageType, uploadedAvatarPath } from "./profile";
import { requireUser } from "./session";
import { deleteObjects, putObject, storageConfigured } from "./storage";

export type ProfileResult = { ok: true } | { ok: false; error: string };

const fail = (error: string) => ({ ok: false as const, error });

// The name sits in the top bar and the greeting, so every page that shows it is refreshed.
const refresh = () => revalidatePath("/", "layout");

export async function saveName(_previous: ProfileResult | null, formData: FormData): Promise<ProfileResult> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!name) return fail("Add the name your clients know you by.");
  if (name.length > photoRules.nameMax) return fail(`Keep your name under ${photoRules.nameMax} characters.`);
  await pool.query(`update "user" set "name" = $1, "updatedAt" = now() where "id" = $2`, [name, user.id]);
  refresh();
  return { ok: true };
}

export async function uploadPhoto(formData: FormData): Promise<ProfileResult> {
  const user = await requireUser();
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size < 1) return fail("Pick a picture first.");
  if (photo.size > photoRules.maxBytes) return fail("This picture is too large. Try a smaller one.");
  const bytes = new Uint8Array(await photo.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type) return fail("Use a JPG, PNG or WebP picture.");
  if (!storageConfigured()) return fail("File storage is not connected yet.");
  try {
    // One object per person: a new picture replaces the old one, and the version in the address busts the browser cache.
    await putObject(avatarKey(user.id), bytes, type);
  } catch (error) {
    console.error("Could not store a profile picture", error);
    return fail("We could not save your picture. Try again.");
  }
  await pool.query(`update "user" set "image" = $1, "updatedAt" = now() where "id" = $2`, [uploadedAvatarPath(user.id), user.id]);
  refresh();
  return { ok: true };
}

// An empty string, not null: null means "never set", which a Google sign-in fills in again. Removing a picture is a choice.
export async function removePhoto(): Promise<ProfileResult> {
  const user = await requireUser();
  await pool.query(`update "user" set "image" = '', "updatedAt" = now() where "id" = $1`, [user.id]);
  await deleteObjects([avatarKey(user.id)]);
  refresh();
  return { ok: true };
}
