"use server";

import { revalidatePath } from "next/cache";
import { pool } from "./auth";
import { logoRules } from "./brand";
import { requireUser } from "./session";
import { deleteObjects, putObject, storageConfigured } from "./storage";
import { pngSize, studioLogoKey } from "./studio";

export type StudioResult = { ok: true } | { ok: false; error: string };

const fail = (error: string) => ({ ok: false as const, error });

// Client pages are rendered on each visit, so only the workspace pages that show the studio need refreshing.
const refresh = () => {
  revalidatePath("/profile");
  revalidatePath("/deliveries", "layout");
};

// An empty name clears it, and the client page goes back to the person's own name.
export async function saveStudioName(_previous: StudioResult | null, formData: FormData): Promise<StudioResult> {
  const user = await requireUser();
  const name =
    String(formData.get("studioName") ?? "")
      .trim()
      .replace(/\s+/g, " ") || null;
  if (name && name.length > logoRules.nameMax) return fail(`Keep your studio name under ${logoRules.nameMax} characters.`);
  await pool.query(
    `insert into "studio" ("userId", "name") values ($1, $2)
     on conflict ("userId") do update set "name" = excluded."name", "updatedAt" = now()`,
    [user.id, name],
  );
  refresh();
  return { ok: true };
}

// The browser sends every logo as a PNG it has already shrunk; anything else is turned away.
export async function uploadStudioLogo(formData: FormData): Promise<StudioResult> {
  const user = await requireUser();
  const logo = formData.get("logo");
  if (!(logo instanceof File) || logo.size < 1) return fail("Pick a logo first.");
  if (logo.size > logoRules.maxBytes) return fail("This logo is too large. Try a smaller one.");
  const bytes = new Uint8Array(await logo.arrayBuffer());
  const size = pngSize(bytes);
  if (!size) return fail("This logo could not be read. Try a PNG, JPG or WebP.");
  if (size.width < 1 || size.height < 1 || size.width > logoRules.maxWidth || size.height > logoRules.maxHeight) {
    return fail("This logo could not be read. Try a PNG, JPG or WebP.");
  }
  if (!storageConfigured()) return fail("File storage is not connected yet.");
  try {
    // One object per person: a new logo replaces the old one, and the version in the address busts the browser cache.
    await putObject(studioLogoKey(user.id), bytes, "image/png");
  } catch (error) {
    console.error("Could not store a studio logo", error);
    return fail("We could not save your logo. Try again.");
  }
  await pool.query(
    `insert into "studio" ("userId", "logoVersion", "logoWidth", "logoHeight") values ($1, $2, $3, $4)
     on conflict ("userId") do update
       set "logoVersion" = excluded."logoVersion", "logoWidth" = excluded."logoWidth", "logoHeight" = excluded."logoHeight",
           "updatedAt" = now()`,
    [user.id, Date.now(), size.width, size.height],
  );
  refresh();
  return { ok: true };
}

export async function removeStudioLogo(): Promise<StudioResult> {
  const user = await requireUser();
  await pool.query(
    `update "studio" set "logoVersion" = null, "logoWidth" = null, "logoHeight" = null, "updatedAt" = now() where "userId" = $1`,
    [user.id],
  );
  await deleteObjects([studioLogoKey(user.id)]);
  refresh();
  return { ok: true };
}
