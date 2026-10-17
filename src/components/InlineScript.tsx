// A script that runs while the browser parses the page, before the first paint. On the client React renders the
// same tag as inert text, so soft navigations neither run it again nor warn about it.
// See "How to prevent flash before hydration" in the Next.js docs.
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
