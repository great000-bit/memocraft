import type { Metadata, Viewport } from "next";

// Client pages open from a private link: no search indexing, and the link is not passed on as a referrer.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// The phone's status bar matches the dark page.
export const viewport: Viewport = { themeColor: "#1a1f1e" };

// Always dark, like the rest of the app.
export default function ClientLayout({ children }: LayoutProps<"/">) {
  return <div className="site-scope">{children}</div>;
}
