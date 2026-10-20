import type { Metadata } from "next";
import { Button } from "@/components/Button";
import { EnhancerShowcase } from "@/components/EnhancerShowcase";
import { Faq, faqJsonLd } from "@/components/Faq";
import { JsonLd } from "@/components/JsonLd";
import { MarketingPage } from "@/components/marketing/MarketingPage";
import styles from "@/components/marketing/Marketing.module.css";
import { enhancerFaqs, SITE_NAME, SITE_URL, socialFor } from "@/lib/site";

const title = "Free photo enhancer: sharpen soft photos and rebuild faces";
const description =
  "Make a soft or low-resolution photo four times bigger and rebuild blurry faces, free. It runs in your browser, so your photo stays on your device.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/photo-enhancer" },
  ...socialFor("/photo-enhancer", `${title} | ${SITE_NAME}`, description),
};

const steps = [
  { title: "Drop in the photo", body: "Choose a soft or small photo. It opens on your device and is never sent to a server." },
  { title: "Faces are found and rebuilt", body: "Memocraft finds each face, rebuilds the detail, and makes the whole picture four times bigger." },
  { title: "Compare and keep it", body: "Drag the line to compare with the original, then save the result or add it to a delivery." },
];

export default function PhotoEnhancerPage() {
  return (
    <MarketingPage crumbs={[{ name: "Free photo enhancer", path: "/photo-enhancer" }]}>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          "@id": `${SITE_URL}/photo-enhancer#app`,
          name: "Memocraft photo enhancer",
          url: `${SITE_URL}/photo-enhancer`,
          description,
          applicationCategory: "MultimediaApplication",
          operatingSystem: "Any, in a web browser",
          isAccessibleForFree: true,
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          isPartOf: { "@id": `${SITE_URL}/#website` },
        }}
      />
      <JsonLd data={faqJsonLd(enhancerFaqs)} />

      <div className={styles.wrap}>
        <section className={styles.section} aria-label="Photo enhancer">
          <EnhancerShowcase heading="h1" />
        </section>

        <section className={styles.section} aria-labelledby="how">
          <h2 id="how" className={styles.h2}>
            How the photo enhancer works
          </h2>
          <ol className={`${styles.grid} ${styles.steps}`} data-cols="3">
            {steps.map((step) => (
              <li key={step.title} className={styles.card}>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.section} aria-labelledby="faq">
          <h2 id="faq" className={styles.h2}>
            Photo enhancer questions
          </h2>
          <Faq items={enhancerFaqs} open={1} />
        </section>

        <section className={styles.final}>
          <h2 className={styles.finalTitle}>Fix the shot, then send it in one link</h2>
          <Button href="/signup" size="lg">
            Try the enhancer free
          </Button>
        </section>
      </div>
    </MarketingPage>
  );
}
