import { pool } from "./auth";
import type { Brand } from "./brand";

export const studioLogoKey = (userId: string) => `studio-logos/${userId}`;

export type Studio = { name: string | null; logoVersion: string | null; logoWidth: number | null; logoHeight: number | null };

export async function getStudio(userId: string): Promise<Studio | null> {
  const { rows } = await pool.query<Studio>(
    `select "name", "logoVersion", "logoWidth", "logoHeight" from "studio" where "userId" = $1`,
    [userId],
  );
  return rows[0] ?? null;
}

// The brand a page shows, given where its logo can be loaded from. The client page loads it through the delivery's
// own link; the workspace (profile, preview) through a route only the owner can open.
export function brandFrom(studio: Studio | null, logoPath: string): Brand {
  const hasLogo = Boolean(studio?.logoVersion && studio.logoWidth && studio.logoHeight);
  return {
    name: studio?.name ?? null,
    logoSrc: hasLogo ? `${logoPath}?v=${studio!.logoVersion}` : null,
    logoWidth: hasLogo ? studio!.logoWidth! : 0,
    logoHeight: hasLogo ? studio!.logoHeight! : 0,
  };
}

export const ownerLogoPath = "/api/studio-logo";
export const clientLogoPath = (slug: string) => `/d/${slug}/logo`;

// A PNG states its size in the first chunk: width and height as 4-byte numbers at bytes 16 and 20.
export function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || !signature.every((byte, index) => bytes[index] === byte)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(12) !== 0x49484452) return null; // "IHDR"
  return { width: view.getUint32(16), height: view.getUint32(20) };
}
