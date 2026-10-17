import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

// Sends people who are already logged in straight to their dashboard. Renders nothing otherwise.
export async function RedirectIfSignedIn() {
  const session = await getSession();
  if (session) redirect("/dashboard");
  return null;
}
