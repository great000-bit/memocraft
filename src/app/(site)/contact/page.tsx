import type { Metadata } from "next";
import { ContactForm } from "@/components/ContactForm";
import { MarketingPage } from "@/components/marketing/MarketingPage";
import styles from "@/components/marketing/Marketing.module.css";
import { SITE_NAME, socialFor } from "@/lib/site";

const title = "Contact";
const description = "Questions, ideas or something that did not work? Write to the Memocraft team and we reply by email.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/contact" },
  ...socialFor("/contact", `${title} | ${SITE_NAME}`, description),
};

export default function ContactPage() {
  return (
    <MarketingPage crumbs={[{ name: "Contact", path: "/contact" }]}>
      <div className={styles.wrap}>
        <section className={styles.hero}>
          <p className={styles.kicker}>Contact</p>
          <h1 className={styles.h1}>Talk to us</h1>
          <p className={styles.lede}>A question before you start, an idea for a feature, or something that did not work. Write it here and we reply by email.</p>
        </section>
        <section className={`${styles.section} ${styles.narrow}`} aria-label="Contact form">
          <ContactForm />
        </section>
      </div>
    </MarketingPage>
  );
}
