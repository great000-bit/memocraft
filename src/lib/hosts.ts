// Which web addresses are Memocraft's own and which belong to a creative ("files.yourstudio.com"). Safe to import
// from the proxy: no database, only the request's host and the app's settings.

const own = (host: string) => host.replace(/^www\./, "");

// The app's own address comes from BETTER_AUTH_URL; APP_HOSTS can add more, separated by commas. Preview and
// production addresses on vercel.app and local development are always the app.
export function isAppHost(rawHost: string | null): boolean {
  if (!rawHost) return true;
  const host = rawHost.split(":")[0].toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".vercel.app") || host.endsWith(".localhost")) return true;
  const known = [process.env.BETTER_AUTH_URL ?? "", ...(process.env.APP_HOSTS ?? "").split(",")]
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      try {
        return new URL(entry.includes("://") ? entry : `https://${entry}`).hostname.toLowerCase();
      } catch {
        return "";
      }
    })
    .filter(Boolean);
  return known.some((entry) => own(entry) === own(host));
}

export const hostOf = (rawHost: string | null) => (rawHost ?? "").split(":")[0].toLowerCase();

// A creative's address: a subdomain such as files.yourstudio.com. Letters, digits and hyphens, at least three
// parts, and never one of ours.
export function domainProblem(input: string): string | null {
  const domain = input.trim().toLowerCase();
  if (!/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) {
    return "Type an address like files.yourstudio.com, without https://.";
  }
  if (domain.split(".").length < 3) return "Use a subdomain such as files.yourstudio.com, so your main website keeps working.";
  if (isAppHost(domain) || /(^|\.)memocraft\./.test(domain)) return "That address belongs to Memocraft.";
  return null;
}

export const cleanDomain = (input: string) =>
  input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
