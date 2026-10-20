import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Search engines and AI assistants are welcome on the marketing pages. Everything signed-in, the API and clients'
// private delivery links stay out.
const PRIVATE = ["/api/", "/dashboard", "/deliveries", "/requests", "/enhancer", "/notifications", "/profile", "/settings", "/admin", "/d/", "/goodbye"];

const ASSISTANTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "Bingbot",
  "DuckAssistBot",
  "Amazonbot",
  "meta-externalagent",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      { userAgent: ASSISTANTS, allow: "/", disallow: PRIVATE },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
