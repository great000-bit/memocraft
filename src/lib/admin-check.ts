// Who may open /admin: the addresses in ADMIN_EMAILS (comma separated), and only once the address is confirmed, so
// signing up with an admin's address and never proving it opens nothing. No list means no admin at all.
// Kept apart from admin.ts so the proxy can use it without pulling in page code.
function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdmin(user: { email: string; emailVerified: boolean }): boolean {
  return user.emailVerified && adminEmails().has(user.email.toLowerCase());
}
