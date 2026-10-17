import { after } from "next/server";

// Email goes out through Resend. Until a sending address on a verified domain is set, nothing here sends and the
// screens that depend on email (password reset, "confirm your email") stay hidden instead of promising what
// cannot happen. RESEND_API_URL exists so tests can point at a local stand-in.
export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

export type OutgoingEmail = { to: string; subject: string; text: string; html: string };

export async function sendEmail(message: OutgoingEmail): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) throw new Error("Email is not set up: RESEND_API_KEY and EMAIL_FROM are missing.");
  const response = await fetch(`${process.env.RESEND_API_URL || "https://api.resend.com"}/emails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text, html: message.html }),
  });
  if (!response.ok) throw new Error(`The email service answered ${response.status}.`);
}

// Sign-in emails go out after the answer is sent. Waiting for the email service would make "an account exists" take
// visibly longer than "no account", which tells a stranger who has one. A failure is logged without the address.
export function sendInBackground(message: OutgoingEmail): void {
  const run = () =>
    sendEmail(message).catch((error) => console.error("Could not send an email:", error instanceof Error ? error.message : error));
  try {
    after(run);
  } catch {
    void run();
  }
}
