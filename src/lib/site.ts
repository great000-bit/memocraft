import type { Metadata } from "next";

// The public address and the facts every page, crawler and AI assistant should agree on. Keep claims here true to the
// product: search engines and answer engines quote them word for word.
export const SITE_URL = "https://www.memocraft.space";
export const SITE_NAME = "Memocraft";
// The day the public pages last changed in a way worth re-crawling. Bump it when copy or pages change.
export const SITE_UPDATED = new Date("2026-10-29");
export const SITE_TAGLINE = "Did they get the files? Now you’ll know.";
export const SITE_DESCRIPTION =
  "Memocraft is client file delivery for photographers, videographers and designers: one link for every delivery, files that explain themselves, downloads made for your client’s phone, and proof of when they opened and saved them. Free to start.";

// Other ways people type the name. Published as alternateName so search engines and assistants tie them to us.
export const SITE_ALT_NAMES = ["MemoCraft", "Memo Craft", "Memocraft app", "memocraft.space"];
// Official profiles elsewhere (X, LinkedIn, Instagram, Product Hunt...). Published as sameAs, which is how Google links
// a brand's profiles to its site. Add each one here once it exists; only real, live URLs.
export const SITE_PROFILES: string[] = [];

// A page that sets its own openGraph replaces the site-wide one, picture included, so each page spells out all of it.
export function socialFor(path: string, title: string, description: string): Pick<Metadata, "openGraph" | "twitter"> {
  return {
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "en_US",
      url: path,
      title,
      description,
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: `${SITE_NAME}: ${SITE_TAGLINE}` }],
    },
    twitter: { card: "summary_large_image", title, description, images: ["/opengraph-image"] },
  };
}

export type Faq = { q: string; a: string };

// What the brand is, in the words people search with when they only know the name.
export const aboutFaqs: Faq[] = [
  {
    q: "What is Memocraft?",
    a: "Memocraft is a client file delivery app for photographers, videographers, filmmakers, designers and studios. You send finished work to a client as one link, and see when they open it and which files they save. Its website is memocraft.space.",
  },
  {
    q: "Is it Memocraft or Memo Craft?",
    a: "The name is Memocraft, one word. People also type it as Memo Craft, MemoCraft or memocrafte. They all mean the same app at www.memocraft.space.",
  },
  {
    q: "Is Memocraft the open-source note-taking app?",
    a: "No. There is an unrelated open-source note-taking project on GitHub that is also called MemoCraft. Memocraft at www.memocraft.space is a different product: a client file delivery app for creative professionals, made by a different team.",
  },
  {
    q: "Is there a Memocraft app for my phone?",
    a: "Yes. Open www.memocraft.space on your phone and add it to your Home Screen. It opens full screen like an app and can send you a notification when a client opens a delivery. There is nothing to download from an app store.",
  },
  {
    q: "Is Memocraft related to Memory Craft sewing machines?",
    a: "No. Memocraft is a file delivery app for creative professionals. It has no connection to sewing machines, scrapbooking or memo pads.",
  },
  {
    q: "How do I contact Memocraft?",
    a: "Use the contact form at www.memocraft.space/contact. We reply by email.",
  },
];

// Shown on the landing page and published as FAQPage data. Answers stand on their own, so an assistant can quote one.
export const homeFaqs: Faq[] = [
  {
    q: "What is Memocraft?",
    a: "Memocraft is a client file delivery app for creatives. You drop your finished photos, videos or design files into a delivery, send your client one link, and see when they open it and which files they save. Clients do not need an account.",
  },
  {
    q: "How do I send photos to a client without a zip file?",
    a: "Create a delivery in Memocraft, drop in the photos and send the link. Your client sees every picture on one page, can save single photos or all of them straight to their phone, or download them on a computer. Nothing is zipped.",
  },
  {
    q: "How do I know if my client downloaded the files?",
    a: "Every Memocraft delivery has proof of delivery. It shows when the link was opened, which files were downloaded and when, and the kind of device, such as iPhone. You can also get a notification on your phone the moment it is opened.",
  },
  {
    q: "Does my client need to sign up?",
    a: "No. Clients open the link on any phone or computer with no account and no app. Only you, the creative, sign in, using your Google account.",
  },
  {
    q: "Is Memocraft free?",
    a: "Yes, you can start free with no card. Make an account with Google and send your first delivery straight away.",
  },
  {
    q: "How big can my files be?",
    a: "Each file can be up to 2 GB. Big uploads are split into parts that retry on their own, so a weak connection after a shoot does not cost you the whole upload.",
  },
  {
    q: "Can I fix a blurry photo before I deliver it?",
    a: "Yes. Memocraft includes a free photo enhancer that makes a photo four times bigger and rebuilds soft faces. It runs in your own browser, so the photo is processed on your device.",
  },
  {
    q: "Can I protect or close a delivery link?",
    a: "Yes. You can add a password, set the date the link closes, or pause it at any time. If you replace a file, the link stays the same and your client sees it marked as updated.",
  },
];

export type Audience = {
  slug: string;
  name: string;
  title: string;
  description: string;
  h1: string;
  lede: string;
  points: { title: string; body: string }[];
  faqs: Faq[];
};

// One page per kind of creative, so each can rank for the way that trade actually searches.
export const audiences: Audience[] = [
  {
    slug: "photographers",
    name: "Photographers",
    title: "Photo delivery for photographers: one link, proof of download",
    description:
      "Deliver photo galleries to clients with one link. Clients save every photo to their phone in a tap, and you see when they opened and downloaded them. Free to start.",
    h1: "Photo delivery your clients can’t lose",
    lede: "Send the whole shoot in one link. Your client saves the photos straight to their phone, and you see the moment they do.",
    points: [
      { title: "Save to their camera roll", body: "On a phone, clients save one photo or all of them to their camera roll. No zip file to unpack, no app to install." },
      { title: "Proof they got the gallery", body: "See when the link was opened and which photos were downloaded, with the time and the kind of device." },
      { title: "Sections that explain the files", body: "Split the edit into “For print” and “For Instagram” with a note on each, so clients use the right file." },
      { title: "Rescue the soft frame", body: "The free enhancer makes a photo four times bigger and rebuilds a slightly missed-focus face before you send it." },
    ],
    faqs: [
      { q: "What is the best way to deliver photos to a client?", a: "Send one link that opens on any phone, shows every photo, and lets the client save them straight to their camera roll. Memocraft does this and shows you when they opened and downloaded the photos." },
      { q: "Can clients download all the photos at once?", a: "Yes. On a phone they can save all photos in one go, and on a computer they can download every file from the same page." },
    ],
  },
  {
    slug: "videographers",
    name: "Videographers",
    title: "Send large video files to clients, with proof of download",
    description:
      "Deliver wedding films, reels and 4K exports to clients with one link. Files up to 2 GB each, uploads that resume, and proof of when your client downloaded them.",
    h1: "Send the film. Know it landed.",
    lede: "Big exports, one link, no expiry surprises. See when your client opened the film and when they saved it.",
    points: [
      { title: "Built for big files", body: "Upload files up to 2 GB each. Uploads go up in parts and retry on their own if the connection drops." },
      { title: "Proof of download", body: "Know which cut was downloaded and when, so “we never got it” becomes a two-second check." },
      { title: "Replace a cut, keep the link", body: "Fixed the subtitles? Replace the file and the same link shows the new version, marked as updated." },
      { title: "Your link, your rules", body: "Add a password, set a closing date or pause the link whenever you need to." },
    ],
    faqs: [
      { q: "How do I send a large video file to a client?", a: "Upload it to a Memocraft delivery and send the link. Files up to 2 GB each are supported, uploads resume after a dropped connection, and you see when the client downloads the file." },
      { q: "Will the link expire before my client downloads the film?", a: "Only if you choose. A Memocraft link stays open until you set a closing date or pause it." },
    ],
  },
  {
    slug: "filmmakers",
    name: "Filmmakers",
    title: "Client delivery for filmmakers: cuts, stills and proof of delivery",
    description:
      "Deliver cuts, stills and project files to clients and producers in one link. Replace a cut without changing the link, and see who opened and downloaded what.",
    h1: "Every cut, still and file in one link",
    lede: "Hand over the film, the stills and the paperwork together. When you send a new cut, the link stays the same.",
    points: [
      { title: "One link per project", body: "Group the cut, the trailer, the stills and the PDFs into sections with a note on each." },
      { title: "New cut, same link", body: "Replace a file and the old version is kept, while your client sees the new one marked as updated." },
      { title: "Proof of delivery", body: "See when producers opened the link and which files they downloaded." },
      { title: "Requests in one place", body: "Clients ask for a missing file or another format from the page, and it lands on your to-do list." },
    ],
    faqs: [
      { q: "How do I share a new cut without sending a new link?", a: "In Memocraft you replace the file in the delivery. The link stays the same, the old version is kept, and the client sees the new file marked as updated." },
      { q: "Can I see if a producer downloaded the final cut?", a: "Yes. Proof of delivery shows when the link was opened and which files were downloaded, with times." },
    ],
  },
  {
    slug: "designers",
    name: "Designers",
    title: "Deliver design files and brand assets to clients",
    description:
      "Hand over logos, brand kits and design files in one clear link. Label every file, let clients request missing formats, and see when they downloaded them.",
    h1: "Brand files that explain themselves",
    lede: "Logo, colours, fonts and every export, labelled so your client knows which file goes where.",
    points: [
      { title: "Files that explain themselves", body: "Name sections like “For web” and “For print” and add a note, so the PNG never ends up on a billboard." },
      { title: "Format requests", body: "Need the SVG, not the PNG? Your client asks in one tap and the request lands on your to-do list." },
      { title: "Proof of handover", body: "See when the brand kit was opened and which files were downloaded." },
      { title: "Update without resending", body: "Tweak a file and replace it. The same link stays current and the old version is kept." },
    ],
    faqs: [
      { q: "How should I hand over a logo and brand kit to a client?", a: "Put every file in one Memocraft delivery, grouped into sections such as “For web” and “For print” with a note on each, then send one link. You see when the client opens it and downloads the files." },
      { q: "What if my client needs a different file format?", a: "They can ask from the delivery page. The request lands on your to-do list in Memocraft." },
    ],
  },
  {
    slug: "brand-studios",
    name: "Brand studios",
    title: "Client delivery for creative and brand studios",
    description:
      "Deliver campaigns to clients under your studio’s name. One link per project, your logo on the page, file requests, version history and proof of delivery.",
    h1: "Deliver under your studio’s name",
    lede: "Every client link carries your logo and studio name, and tells you when the work was opened and saved.",
    points: [
      { title: "Your name comes first", body: "Your studio logo and name lead every delivery page, so clients remember who made the work." },
      { title: "Proof for every handover", body: "Opened, downloaded and updated, all with times, for every client and every project." },
      { title: "Version history", body: "Replace files without breaking links. Older versions are kept, so nothing is overwritten by mistake." },
      { title: "Requests without email chains", body: "Clients ask for what’s missing from the page, and it lands on your list." },
    ],
    faqs: [
      { q: "Can I put my studio logo on client delivery pages?", a: "Yes. Your studio name and logo appear at the top of every Memocraft delivery page." },
      { q: "How do I track which client downloaded which files?", a: "Each delivery has its own proof of delivery: when the link was opened, which files were downloaded and when." },
    ],
  },
  {
    slug: "illustrators",
    name: "Illustrators",
    title: "Deliver illustrations and artwork files to clients",
    description:
      "Send final artwork, print files and process files in one link. Label each file, protect the link with a password, and see when your client downloaded the work.",
    h1: "Final artwork, delivered properly",
    lede: "Print files, web files and the layered originals, each labelled, in one link your client can open anywhere.",
    points: [
      { title: "Print and web, side by side", body: "Separate the high-resolution print files from the web versions with a short note on each." },
      { title: "Protect the originals", body: "Add a password or a closing date to the link, or pause it until the invoice is paid." },
      { title: "Proof they downloaded it", body: "See when the client opened the delivery and which files they saved." },
      { title: "Bigger, cleaner previews", body: "The free enhancer makes a small export four times bigger when a client needs a larger file." },
    ],
    faqs: [
      { q: "How can I send artwork files to a client securely?", a: "Send them in a Memocraft delivery with a password or a closing date. You can pause the link at any time and see when it was opened." },
      { q: "Can I pause a link until I'm paid?", a: "Yes. You can pause a Memocraft link in one tap and turn it back on when you are ready." },
    ],
  },
];

export const enhancerFaqs: Faq[] = [
  {
    q: "Is the Memocraft photo enhancer free?",
    a: "Yes. The photo enhancer is free with every Memocraft account. Sign in with Google and open Enhancer in the sidebar.",
  },
  {
    q: "Can it fix a blurry face?",
    a: "It finds every face in the photo and rebuilds the detail, which works best on faces that are slightly soft or small in the frame. A photo that is badly out of focus will improve but may not look perfect.",
  },
  {
    q: "Is my photo uploaded to a server?",
    a: "No. The enhancer runs in your own browser, so the photo is processed on your device. It is only saved to your account if you add the result to a delivery.",
  },
  {
    q: "How much bigger does it make a photo?",
    a: "Four times wider and taller than the photo it starts from. Very large photos are scaled down first so the enhancer finishes in about a minute on a typical laptop.",
  },
];
