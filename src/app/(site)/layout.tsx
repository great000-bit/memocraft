import type { Viewport } from "next";

// The phone's status bar matches the dark page.
export const viewport: Viewport = { themeColor: "#1a1f1e" };

// Marketing and sign-in pages are always dark, like the rest of the app.
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return <div className="site-scope">{children}</div>;
}
