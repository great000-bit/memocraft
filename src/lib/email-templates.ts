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
