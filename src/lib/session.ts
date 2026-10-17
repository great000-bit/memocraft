import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

const retryReadAfterMs = 400;

// Reading a session changes nothing the visitor would notice, so when the database drops the connection
// mid-read (Neon waking up or restarting) it is safe to ask once more on a fresh connection. A second
// failure is a real outage and still surfaces.
async function readSession(requestHeaders: Headers) {
  try {
    return await auth.api.getSession({ headers: requestHeaders });
  } catch (error) {
    console.warn("Session lookup failed, trying once more:", error instanceof Error ? error.message : error);
    await new Promise((resolve) => setTimeout(resolve, retryReadAfterMs));
    return auth.api.getSession({ headers: requestHeaders });
  }
}

// Reads the session from the request cookie. Components that call this must sit behind <Suspense>.
export const getSession = cache(async () => readSession(await headers()));

export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session.user;
}
