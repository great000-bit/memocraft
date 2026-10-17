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
