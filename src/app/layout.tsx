import type { Metadata } from "next";
import { Instrument_Sans, JetBrains_Mono, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";

const schibsted = Schibsted_Grotesk({
  variable: "--font-schibsted",
  subsets: ["latin"],
  weight: ["700", "800"],
});

const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Memocraft: deliver creative work your clients understand",
  description:
    "One link for every delivery. Files that explain themselves, proof your client got them, and downloads made for their phone.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${schibsted.variable} ${instrument.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  );
}
