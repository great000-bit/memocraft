import type { Metadata } from "next";
import { Archivo, Bodoni_Moda, Instrument_Sans, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";
import "./globals.css";

// Archivo's width axis gives the wide grotesk headings of the Dropbox-style layout.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
});

// Only links and file sizes use the mono face, so it is not preloaded on every page.
const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  preload: false,
});

// The client cover templates' serif and Didone faces. Only a cover that uses one downloads it.
const instrumentSerif = Instrument_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  preload: false,
});

const bodoni = Bodoni_Moda({
  variable: "--font-didone",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME}: client file delivery with proof of download`, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "client file delivery",
    "photo delivery",
    "send photos to clients",
    "client gallery",
    "proof of delivery",
    "send large files",
    "deliver files to clients",
    "photographer client delivery",
    "free photo enhancer",
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "photography",
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    title: `${SITE_NAME}: ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME}: ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  robots: { index: true, follow: true, googleBot: { "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  // Added to an iPhone's Home Screen, Memocraft opens full screen like an app, with its own icon.
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} ${instrument.variable} ${jetbrains.variable} ${instrumentSerif.variable} ${bodoni.variable}`}>
      <body>{children}</body>
    </html>
  );
}
