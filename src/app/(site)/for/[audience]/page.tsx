import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/Button";
import { Faq, faqJsonLd } from "@/components/Faq";
import { JsonLd } from "@/components/JsonLd";
import { MarketingPage } from "@/components/marketing/MarketingPage";
import styles from "@/components/marketing/Marketing.module.css";
import { audiences, homeFaqs, SITE_NAME, SITE_URL, socialFor } from "@/lib/site";

export function generateStaticParams() {
  return audiences.map((a) => ({ audience: a.slug }));
}

export async function generateMetadata({ params }: PageProps<"/for/[audience]">): Promise<Metadata> {
  const { audience } = await params;
  const page = audiences.find((a) => a.slug === audience);
  if (!page) return {};
  const path = `/for/${page.slug}`;
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: path },
    ...socialFor(path, `${page.title} | ${SITE_NAME}`, page.description),
  };
}

const steps = [
  { title: "Drop in the finished work", body: "Drag in the files, name the delivery and add a note wherever it helps." },
  { title: "Send one link", body: "Paste it into email or WhatsApp. Your client opens it on any device with no sign-up." },
  { title: "See when it lands", body: "Watch the link get opened and each file get saved, with the time and the kind of device." },
];

export default async function AudiencePage({ params }: PageProps<"/for/[audience]">) {
  const { audience } = await params;
  const page = audiences.find((a) => a.slug === audience);
  if (!page) notFound();
  const path = `/for/${page.slug}`;
  const faqs = [...page.faqs, ...homeFaqs.slice(0, 3)];

  return (
    <MarketingPage crumbs={[{ name: page.name, path }]}>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          "@id": `${SITE_URL}${path}`,
          url: `${SITE_URL}${path}`,
          name: page.title,
          description: page.description,
          isPartOf: { "@id": `${SITE_URL}/#website` },
          about: { "@id": `${SITE_URL}/#app` },
        }}
      />
      <JsonLd data={faqJsonLd(faqs)} />

      <div className={styles.wrap}>
        <section className={styles.hero}>
          <p className={styles.kicker}>For {page.name.toLowerCase()}</p>
          <h1 className={styles.h1}>{page.h1}</h1>
          <p className={styles.lede}>{page.lede}</p>
          <div className={styles.ctas}>
            <Button href="/signup" size="lg">
              Send your first delivery free
            </Button>
          </div>
          <p className={styles.fine}>No card. No zip files. Your clients never make an account.</p>
        </section>

        <section className={styles.section} aria-labelledby="why">
          <h2 id="why" className={styles.h2}>
            What {page.name.toLowerCase()} get
          </h2>
          <ul className={styles.grid}>
            {page.points.map((point) => (
              <li key={point.title} className={styles.card}>
                <h3>{point.title}</h3>
                <p>{point.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="how">
          <h2 id="how" className={styles.h2}>
            Three steps to deliver
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
            Questions {page.name.toLowerCase()} ask
          </h2>
          <Faq items={faqs} open={1} />
        </section>

        <section className={styles.section} aria-labelledby="others">
          <h2 id="others" className={styles.h2}>
            Memocraft for every kind of creative
          </h2>
          <ul className={styles.links}>
            {audiences
              .filter((a) => a.slug !== page.slug)
              .map((a) => (
                <li key={a.slug}>
                  <Link href={`/for/${a.slug}`}>{a.name}</Link>
                </li>
              ))}
            <li>
              <Link href="/photo-enhancer">Free photo enhancer</Link>
            </li>
          </ul>
        </section>

        <section className={styles.final}>
          <h2 className={styles.finalTitle}>The handover is part of the work</h2>
          <Button href="/signup" size="lg">
            Send your first delivery free
          </Button>
        </section>
      </div>
    </MarketingPage>
  );
}
