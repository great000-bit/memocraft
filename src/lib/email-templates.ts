import type { OutgoingEmail } from "./email";

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] as string);

const firstName = (name: string) => name.trim().split(/\s+/)[0] || "there";

function layout(options: { name: string; lines: string[]; button: string; url: string; footer: string }): { text: string; html: string } {
  const greeting = `Hi ${firstName(options.name)},`;
  const text = [greeting, "", ...options.lines, "", options.url, "", options.footer, "", "Memocraft"].join("\n");
  const paragraphs = options.lines.map((line) => `<p style="margin:0 0 16px;font-size:16px;line-height:24px">${escapeHtml(line)}</p>`).join("");
  const html = `<!doctype html><html><body style="margin:0;background:#ffffff"><div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#1e1919">
<p style="margin:0 0 24px;font-size:22px;font-weight:700;letter-spacing:-0.02em">Memocraft</p>
<p style="margin:0 0 16px;font-size:16px;line-height:24px">${escapeHtml(greeting)}</p>${paragraphs}
<p style="margin:24px 0"><a href="${escapeHtml(options.url)}" style="display:inline-block;background:#0b6b5d;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:600;font-size:16px">${escapeHtml(options.button)}</a></p>
<p style="margin:0 0 16px;font-size:14px;line-height:20px;color:#5c5856">Or paste this link into your browser:<br><span style="word-break:break-all">${escapeHtml(options.url)}</span></p>
<p style="margin:0;font-size:14px;line-height:20px;color:#5c5856">${escapeHtml(options.footer)}</p>
</div></body></html>`;
  return { text, html };
}

export function resetPasswordEmail(to: string, name: string, url: string): OutgoingEmail {
  return {
    to,
    subject: "Reset your Memocraft password",
    ...layout({
      name,
      lines: ["Someone asked to reset the password for your Memocraft account. The link below works for one hour."],
      button: "Choose a new password",
      url,
      footer: "If this was not you, ignore this email. Your password stays the same.",
    }),
  };
}

export function verifyEmailEmail(to: string, name: string, url: string): OutgoingEmail {
  return {
    to,
    subject: "Confirm your email for Memocraft",
    ...layout({
      name,
      lines: ["Confirm that this is your email address, so we can reach you about your deliveries. The link works for a day."],
      button: "Confirm my email",
      url,
      footer: "If you did not create a Memocraft account, ignore this email.",
    }),
  };
}

// A client asked about a file on a delivery page. Built with tables and inline styles, which is what email apps
// still render reliably, in the product's colours: sage canvas, white card, teal button, amber accent. The client's
// words are untrusted and always escaped.
export function requestEmail(options: {
  to: string;
  ownerName: string;
  clientName: string | null;
  deliveryTitle: string;
  fileName: string | null;
  message: string;
  url: string;
}): OutgoingEmail {
  const who = options.clientName?.trim() || "Your client";
  const about = options.fileName ? `about ${options.fileName}` : "for something new";
  const subject = `${who} asked ${about} · ${options.deliveryTitle}`;
  const text = [
    `Hi ${firstName(options.ownerName)},`,
    "",
    `${who} asked ${about} on ${options.deliveryTitle}:`,
    "",
    `"${options.message}"`,
    "",
    `Open the request: ${options.url}`,
    "",
    "You get this email when a client asks for something on one of your deliveries.",
    "",
    "Memocraft",
  ].join("\n");
  const e = escapeHtml;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${e(subject)}</title></head>
<body style="margin:0;padding:0;background:#eef2f0;-webkit-text-size-adjust:100%">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${e(options.message.slice(0, 120))}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f0">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
<tr><td style="padding:0 8px 20px;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;letter-spacing:-0.5px;color:#171a19">M<span style="color:#e8a33d">em</span>ocraft</td></tr>
<tr><td style="background:#ffffff;border-radius:24px;padding:32px 28px;font-family:Arial,Helvetica,sans-serif;color:#171a19;box-shadow:0 12px 32px -16px rgba(16,24,20,0.18)">
<p style="margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#8a5208">New request</p>
<h1 style="margin:0 0 8px;font-size:24px;line-height:30px;font-weight:700;letter-spacing:-0.4px">${e(who)} asked ${e(about)}</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:22px;color:#5b6662">On <b style="color:#171a19">${e(options.deliveryTitle)}</b></p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="width:4px;background:#e8a33d;border-radius:4px"></td>
<td style="padding:16px 18px;background:#f6f8f7;border-radius:0 14px 14px 0;font-size:16px;line-height:24px;color:#171a19;white-space:pre-wrap">${e(options.message)}</td>
</tr></table>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 0"><tr><td style="border-radius:999px;background:#0b6b5d">
<a href="${e(options.url)}" style="display:inline-block;padding:15px 28px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px">Open the request</a>
</td></tr></table>
<p style="margin:20px 0 0;font-size:13px;line-height:20px;color:#7a8682">Reply to your client the way you usually do. When it is sorted, mark it done in Memocraft.</p>
</td></tr>
<tr><td style="padding:20px 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#7a8682">You get this email when a client asks for something on one of your deliveries. Memocraft never shares your address with your clients.</td></tr>
</table>
</td></tr></table>
</body></html>`;
  return { to: options.to, subject, text, html };
}

// The dark card the welcome, contact and signup emails share, matching the always-dark site: near-black sage canvas,
// raised card, teal button, amber "em" in the wordmark. color-scheme says dark, so mail apps that recolour light
// emails leave it alone. Tables and inline styles because that is what email apps still render reliably.
function darkShell(options: { title: string; preheader: string; body: string; footer: string }): string {
  const e = escapeHtml;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>${e(options.title)}</title></head>
<body style="margin:0;padding:0;background:#121615;-webkit-text-size-adjust:100%">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${e(options.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#121615">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px">
<tr><td style="padding:0 8px 20px;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;letter-spacing:-0.5px;color:#e6eae8">M<span style="color:#e8a33d">em</span>ocraft</td></tr>
<tr><td style="background:#1d2321;border:1px solid #2f3734;border-radius:24px;padding:32px 28px;font-family:Arial,Helvetica,sans-serif;color:#e6eae8">
${options.body}
</td></tr>
<tr><td style="padding:20px 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#8d9792">${options.footer}</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

const darkButton = (label: string, url: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 0"><tr><td style="border-radius:999px;background:#0e7565">
<a href="${escapeHtml(url)}" style="display:inline-block;padding:15px 28px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px">${escapeHtml(label)}</a>
</td></tr></table>`;

const welcomeFeatures = [
  { title: "Send your first delivery", body: "Drop in finished files. Each one becomes a card named from its file, ready for your client." },
  { title: "One link for your client", body: "Share a single link. Your client needs no account, and the link stays current when you update a file." },
  { title: "Proof of delivery", body: "See when your client opened the link and which files they downloaded, so you never have to ask." },
  { title: "Save to phone", body: "On a phone, clients save photos straight to their camera roll. No zip files." },
  { title: "Free photo enhancer", body: "Sharpen a soft shot and repair faces right in your browser, free, before you send it." },
];

// Sent once, the first time someone signs in with Google and their account is created.
export function welcomeEmail(to: string, name: string, baseUrl: string): OutgoingEmail {
  const first = firstName(name);
  const start = new URL("/deliveries/new", baseUrl).toString();
  const contact = new URL("/contact", baseUrl).toString();
  const subject = `Welcome to Memocraft, ${first}`;
  const text = [
    `Hi ${first},`,
    "",
    "Welcome to Memocraft. Your account is ready, and your first delivery is a few minutes away. Here is what to try:",
    "",
    ...welcomeFeatures.map((f, i) => `${i + 1}. ${f.title}: ${f.body}`),
    "",
    `Send your first delivery: ${start}`,
    "",
    `Questions or ideas? Write to us at ${contact}`,
    "",
    "Memocraft",
  ].join("\n");
  const e = escapeHtml;
  const rows = welcomeFeatures
    .map(
      (f, i) => `<tr><td style="padding:0 0 18px;vertical-align:top;width:40px">
<div style="width:28px;height:28px;line-height:28px;border-radius:999px;background:rgba(232,163,61,0.16);color:#f0b660;font-size:13px;font-weight:700;text-align:center">${i + 1}</div>
</td><td style="padding:0 0 18px;vertical-align:top">
<p style="margin:0 0 4px;font-size:16px;line-height:22px;font-weight:700;color:#e6eae8">${e(f.title)}</p>
<p style="margin:0;font-size:15px;line-height:22px;color:#a9b3ae">${e(f.body)}</p>
</td></tr>`,
    )
    .join("");
  const body = `<p style="margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#5fcfbb">Welcome</p>
<h1 style="margin:0 0 12px;font-size:26px;line-height:32px;font-weight:700;letter-spacing:-0.4px;color:#e6eae8">Hi ${e(first)}, your account is ready</h1>
<p style="margin:0 0 28px;font-size:16px;line-height:24px;color:#a9b3ae">Your first delivery is a few minutes away. Here is what to try first:</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
${darkButton("Send your first delivery", start)}`;
  const footer = `You get this email once, because you just created a Memocraft account. Questions or ideas? <a href="${e(contact)}" style="color:#5fcfbb">Write to us</a>.`;
  return { to, subject, text, html: darkShell({ title: subject, preheader: "Your first delivery is a few minutes away.", body, footer }) };
}

// A visitor wrote through the contact form. Goes to the founder's inbox with reply-to set to the visitor, so a
// reply in Gmail reaches them directly. Every visitor value is untrusted and escaped.
export function contactEmail(options: { to: string; name: string; email: string; message: string }): OutgoingEmail {
  const subject = `Contact form: ${options.name}`;
  const text = [`From: ${options.name} <${options.email}>`, "", options.message, "", "Reply to this email to answer them.", "", "Memocraft contact form"].join(
    "\n",
  );
  const e = escapeHtml;
  const body = `<p style="margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#f0b660">New message</p>
<h1 style="margin:0 0 8px;font-size:24px;line-height:30px;font-weight:700;letter-spacing:-0.4px;color:#e6eae8">${e(options.name)}</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:22px;color:#a9b3ae">${e(options.email)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="width:4px;background:#e8a33d;border-radius:4px"></td>
<td style="padding:16px 18px;background:#161b1a;border-radius:0 14px 14px 0;font-size:16px;line-height:24px;color:#e6eae8;white-space:pre-wrap">${e(options.message)}</td>
</tr></table>
<p style="margin:20px 0 0;font-size:13px;line-height:20px;color:#8d9792">Reply to this email to answer them. Your reply goes straight to ${e(options.email)}.</p>`;
  return {
    to: options.to,
    subject,
    text,
    replyTo: options.email,
    html: darkShell({ title: subject, preheader: options.message.slice(0, 120), body, footer: "Sent from the contact form on memocraft.space." }),
  };
}

// A short note to the founder when someone creates an account.
export function signupAlertEmail(to: string, user: { name: string; email: string }): OutgoingEmail {
  const subject = `New Memocraft signup: ${user.name}`;
  const text = [`${user.name} <${user.email}> just created a Memocraft account with Google.`, "", "Memocraft"].join("\n");
  const e = escapeHtml;
  const body = `<p style="margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#5fcfbb">New signup</p>
<h1 style="margin:0 0 8px;font-size:24px;line-height:30px;font-weight:700;letter-spacing:-0.4px;color:#e6eae8">${e(user.name)}</h1>
<p style="margin:0;font-size:15px;line-height:22px;color:#a9b3ae">${e(user.email)} just created an account with Google.</p>`;
  return { to, subject, text, html: darkShell({ title: subject, preheader: `${user.name} just signed up.`, body, footer: "Turn these off with SIGNUP_ALERTS=off." }) };
}
