import { hostOf } from "@/lib/hosts";

// A creative's own web address is working when this answers on it: their DNS points here and the address is added
// to the Memocraft project. The settings page asks it to tell "set up" from "waiting".
export function GET(request: Request) {
  return Response.json({ app: "memocraft", host: hostOf(request.headers.get("host")) }, { headers: { "Cache-Control": "no-store" } });
}
