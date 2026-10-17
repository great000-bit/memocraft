import { raiseDueReminders } from "@/lib/reminders";

// Vercel calls this once a day (see vercel.json). With CRON_SECRET set, Vercel sends it as a bearer token and
// nobody else can run the job. Without it the job still only sends reminders that are already due, each once.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const raised = await raiseDueReminders();
  return Response.json({ raised }, { headers: { "Cache-Control": "no-store" } });
}
