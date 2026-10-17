// Where a profile picture can come from and how it is shown. Safe to import from client components.
//
// user.image holds one of three things:
//   a Google picture URL   - copied from the Google sign-in
//   /api/avatar/<id>?v=<n> - a picture uploaded in the profile, kept in file storage
//   "" (empty)             - the person removed their picture on purpose, so it is not filled in again
// null means no picture was ever set, which is the only state a Google sign-in fills.
const googlePicture = /^https:\/\/lh[3-6]\.googleusercontent\.com\//;
const uploadedPicture = /^\/api\/avatar\/[\w-]+(\?v=\d+)?$/;

export const isGooglePicture = (value: string) => googlePicture.test(value);
export const isUploadedPicture = (value: string) => uploadedPicture.test(value);

// What the browser is told to load. A value that is neither of the two known kinds is ignored.
export function avatarSource(image: string | null | undefined, size: number): string | null {
  if (!image) return null;
  if (isUploadedPicture(image)) return image;
  if (!isGooglePicture(image)) return null;
  // Google sizes its pictures with a suffix; ask for the size that is shown, doubled for sharp screens.
  return `${image.replace(/=s\d+(-c)?$/, "")}=s${size}-c`;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "")).toUpperCase() || "M";
}

// The browser squares and shrinks a picture before sending it; the server enforces the same numbers.
export const photoRules = { edge: 512, maxBytes: 900 * 1024, nameMax: 80 } as const;
