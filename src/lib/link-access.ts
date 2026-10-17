import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { passwordRules } from "./delivery-limits";

// Password protection for client links. The password is stored as a salted scrypt hash. A client who types it
// right gets a signed cookie for that one link, so they are not asked again on every picture and download.

const keyLength = 32;
const scryptCost = { N: 16384, r: 8, p: 1 } as const;

// The same password typed on a phone or a laptop can differ in Unicode form; whitespace around it is a paste slip.
const normalize = (password: string) => password.normalize("NFKC").trim();

export function passwordProblem(password: string): string | null {
  const cleaned = normalize(password);
  if (cleaned.length < passwordRules.min) return `The password needs at least ${passwordRules.min} characters.`;
  if (cleaned.length > passwordRules.max) return `The password can be at most ${passwordRules.max} characters.`;
  return null;
}

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(normalize(password), salt, keyLength, scryptCost, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `s1$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [version, salt, key] = stored.split("$");
  if (version !== "s1" || !salt || !key || password.length > passwordRules.max * 4) return false;
  const expected = Buffer.from(key, "base64url");
  const actual = await derive(password, Buffer.from(salt, "base64url"));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// How long a client stays unlocked on one device after typing the password.
export const unlockSeconds = 7 * 24 * 60 * 60;

function secret(): string {
  const value = process.env.BETTER_AUTH_SECRET;
  if (!value) throw new Error("BETTER_AUTH_SECRET is not set.");
  return value;
}

// The cookie proves the password was typed for this delivery. It is tied to the stored hash, so changing or
// removing the password locks everyone out again at once.
function sign(deliveryId: string, passwordHash: string, expires: number): string {
  return createHmac("sha256", secret())
    .update(`memocraft/link-access/v1|${deliveryId}|${passwordHash}|${expires}`)
    .digest("base64url");
}

export const unlockCookieName = (deliveryId: string) => `mc-unlock-${deliveryId}`;

export function makeUnlockCookie(deliveryId: string, passwordHash: string): string {
  const expires = Math.floor(Date.now() / 1000) + unlockSeconds;
  return `${expires}.${sign(deliveryId, passwordHash, expires)}`;
}

function cookieIsValid(value: string | undefined, deliveryId: string, passwordHash: string): boolean {
  if (!value) return false;
  const [expiresText, mac] = value.split(".");
  const expires = Number(expiresText);
  if (!mac || !Number.isInteger(expires) || expires < Date.now() / 1000) return false;
  const expected = Buffer.from(sign(deliveryId, passwordHash, expires));
  const actual = Buffer.from(mac);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// True when the link has no password, or this browser already typed it. Pages, pictures, downloads and the
// open signal all ask this, so a protected delivery gives nothing to someone who only has the address.
export async function passesPassword(deliveryId: string, passwordHash: string | null): Promise<boolean> {
  if (!passwordHash) return true;
  const store = await cookies();
  return cookieIsValid(store.get(unlockCookieName(deliveryId))?.value, deliveryId, passwordHash);
}
