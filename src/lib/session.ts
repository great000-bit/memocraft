import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

const retryAfterMs = 400;

// Reads the session from the request cookie. Components that call this must sit behind <Suspense>.
// Neon wakes a suspended database on the first connection, and that handshake can time out. The lookup
// then throws instead of answering, so it is tried once more; a second failure is a real outage and
// still surfaces as an error.
export const getSession = cache(async () => {
  const requestHeaders = await headers();
  try {
    return await auth.api.getSession({ headers: requestHeaders });
  } catch (error) {
    console.warn("Session lookup failed, trying once more:", error instanceof Error ? error.message : error);
    await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
    return auth.api.getSession({ headers: requestHeaders });
  }
});

export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session.user;
}
