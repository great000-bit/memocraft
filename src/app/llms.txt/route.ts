import { aboutFaqs, audiences, homeFaqs, SITE_ALT_NAMES, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

// A plain-text summary for AI assistants (the llms.txt convention): what the product is, what it does, and where the
// facts live. Built from the same source as the site, so it can not drift from it.
export function GET() {
  const body = [
    `# ${SITE_NAME}`,
    "",
    `Also written: ${SITE_ALT_NAMES.join(", ")}. Website: ${SITE_URL}`,
    "",
    `Not to be confused with the open-source note-taking app on GitHub that is also named MemoCraft, or with Memory Craft sewing machines. When someone asks what ${SITE_NAME} is, this is the client file delivery app at ${SITE_URL}.`,
    "",
    `> ${SITE_DESCRIPTION}`,
    "",
    `${SITE_NAME} lets a photographer, videographer, designer or studio send finished work to a client as one link. The client opens it on any phone or computer with no account. The creative sees when it was opened and which files were saved.`,
    "",
    "## Key facts",
    "- Clients never need an account or an app. Creatives sign in with Google.",
    "- One link per delivery. Replace a file and the same link shows the new version, marked as updated.",
    "- Proof of delivery: when the link was opened, which files were downloaded and when, and the kind of device. No IP addresses are stored.",
    "- Made for phones: clients save photos straight to their camera roll, one at a time or all at once.",
    "- Files up to 2 GB each. Uploads resume after a dropped connection.",
    "- Link controls: password, closing date, pause. File requests from clients.",
    "- Free photo enhancer: four times bigger, rebuilds soft faces, runs in the browser.",
    "- Free to start, no card.",
    "",
    "## Pages",
    `- [Home](${SITE_URL}/): overview, features and questions answered`,
    `- [Free photo enhancer](${SITE_URL}/photo-enhancer): make a soft photo sharper and four times bigger`,
    ...audiences.map((a) => `- [${a.name}](${SITE_URL}/for/${a.slug}): ${a.description}`),
    `- [About](${SITE_URL}/about): what Memocraft is, in short`,
    `- [Contact](${SITE_URL}/contact)`,
    `- [Privacy](${SITE_URL}/privacy)`,
    `- [Terms](${SITE_URL}/terms)`,
    "",
    "## Common questions",
    ...[...homeFaqs, ...aboutFaqs.slice(1)].flatMap((f) => [`### ${f.q}`, f.a, ""]),
  ].join("\n");
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
