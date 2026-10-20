import { contactInbox, emailConfigured, sendEmail } from "@/lib/email";
import { contactEmail } from "@/lib/email-templates";
import { clientIp, contactAllowed, contactLimits, looksLikeEmail } from "@/lib/contact";

// The contact form posts here. The message is emailed to the founder's inbox, which is read from CONTACT_TO_EMAIL on
// the server and never sent to a page. Bots that fill the hidden field, or submit faster than a person can type, get
// a polite "sent" and nothing goes out.
type Body = { name?: unknown; email?: unknown; message?: unknown; website?: unknown; startedAt?: unknown };

const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.replace(/[\r\n\t]+/g, " ").trim().slice(0, max + 1) : "";

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "Something went wrong. Try again." }, { status: 400 });
  }

  const startedAt = typeof body.startedAt === "number" ? body.startedAt : 0;
  if ((typeof body.website === "string" && body.website !== "") || Date.now() - startedAt < 3000) {
    return Response.json({ ok: true });
  }

  const name = clean(body.name, contactLimits.name);
  const email = clean(body.email, contactLimits.email);
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!name) return Response.json({ error: "Add your name." }, { status: 400 });
  if (name.length > contactLimits.name) return Response.json({ error: "That name is too long." }, { status: 400 });
  if (!looksLikeEmail(email) || email.length > contactLimits.email) {
    return Response.json({ error: "Check your email address, so we can write back." }, { status: 400 });
  }
  if (message.length < contactLimits.messageMin) return Response.json({ error: "Tell us a little more, in a sentence or two." }, { status: 400 });
  if (message.length > contactLimits.message) {
    return Response.json({ error: `Keep it under ${contactLimits.message} characters.` }, { status: 400 });
  }

  const inbox = contactInbox();
  if (!emailConfigured() || !inbox) {
    return Response.json({ error: "The contact form is not switched on yet. Try again soon." }, { status: 503 });
  }
  if (!(await contactAllowed(clientIp(request.headers)))) {
    return Response.json({ error: "You have sent a few messages already. Try again in an hour." }, { status: 429 });
  }

  try {
    await sendEmail(contactEmail({ to: inbox, name, email, message }));
  } catch (error) {
    console.error("Could not send a contact message:", error instanceof Error ? error.message : error);
    return Response.json({ error: "Your message did not go through. Try again in a minute." }, { status: 502 });
  }
  return Response.json({ ok: true });
}
