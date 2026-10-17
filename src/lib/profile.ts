import { pool } from "./auth";

export const avatarKey = (userId: string) => `avatars/${userId}`;

export const uploadedAvatarPath = (userId: string) => `/api/avatar/${userId}?v=${Date.now()}`;

export type ImageType = "image/jpeg" | "image/png" | "image/webp";

// The type comes from the bytes, never from the file name or the type the browser claims.
export function sniffImageType(bytes: Uint8Array): ImageType | null {
  const startsWith = (...signature: number[]) => signature.every((byte, index) => bytes[index] === byte);
  if (startsWith(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (startsWith(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return "image/webp";
  }
  return null;
}

export type SignInMethod = "google" | "password";

// "credential" is how Better Auth names the email and password login.
export async function signInMethods(userId: string): Promise<SignInMethod[]> {
  const { rows } = await pool.query<{ providerId: string }>(`select "providerId" from account where "userId" = $1`, [userId]);
  const methods: SignInMethod[] = [];
  if (rows.some((row) => row.providerId === "credential")) methods.push("password");
  if (rows.some((row) => row.providerId === "google")) methods.push("google");
  return methods;
}
