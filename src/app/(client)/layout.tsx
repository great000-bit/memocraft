import type { Metadata } from "next";

// Client pages open from a private link: no search indexing, and the link is not passed on as a referrer.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// Always light and white, whatever the device theme, like the marketing pages.
export default function ClientLayout({ children }: LayoutProps<"/">) {
  return <div className="light-scope">{children}</div>;
}
