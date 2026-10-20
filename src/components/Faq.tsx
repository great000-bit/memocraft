import type { Faq as FaqItem } from "@/lib/site";
import styles from "./Faq.module.css";

// Questions people (and assistants) ask, answered in plain words. Native <details>, so it works without scripts and
// every answer is in the page for crawlers.
export function Faq({ items, open = 0 }: { items: FaqItem[]; open?: number }) {
  return (
    <div className={styles.list}>
      {items.map((item, i) => (
        <details key={item.q} className={styles.item} open={i < open}>
          <summary className={styles.q}>
            {item.q}
            <span className={styles.icon} aria-hidden="true" />
          </summary>
          <p className={styles.a}>{item.a}</p>
        </details>
      ))}
    </div>
  );
}

// FAQPage structured data for the same questions.
export function faqJsonLd(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}
