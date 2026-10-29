import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/Button";
import { Faq, faqJsonLd } from "@/components/Faq";
import { JsonLd } from "@/components/JsonLd";
import { MarketingPage } from "@/components/marketing/MarketingPage";
import styles from "@/components/marketing/Marketing.module.css";
import { aboutFaqs, audiences, SITE_NAME, SITE_URL, socialFor } from "@/lib/site";

const title = "About Memocraft";
const description =
  "Memocraft (also typed Memo Craft) is a client file delivery app for creatives: one link per delivery, files that explain themselves, downloads made for phones and proof of delivery.";

export const metadata: Metadata = {
  title: { absolute: `${title}: the client delivery app for creatives` },
  description,
  alternates: { canonical: "/about" },
  ...socialFor("/about", title, description),
};

const facts = [
  { title: "What it is", body: "A web app that sends finished photos, videos and design files to clients as one link, with proof of when they were opened and saved." },
  { title: "Who it is for", body: "Photographers, videographers, filmmakers, designers, illustrators and brand studios, anywhere in the world." },
  { title: "What it costs", body: "Free to start, with no card. Creatives sign in with Google. Clients never make an account." },
  { title: "Where to find it", body: "www.memocraft.space, on any computer or phone. Add it to your Home Screen to use it like an app." },
];

// The page that answers a search for the name itself, in every spelling people use.
export default function AboutPage() {
  return (
    <MarketingPage crumbs={[{ name: "About", path: "/about" }]}>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "AboutPage",
          "@id": `${SITE_URL}/about`,
          url: `${SITE_URL}/about`,
          name: title,
          description,
          isPartOf: { "@id": `${SITE_URL}/#website` },
          about: { "@id": `${SITE_URL}/#organization` },
          mainEntity: { "@id": `${SITE_URL}/#app` },
        }}
      />
      <JsonLd data={faqJsonLd(aboutFaqs)} />

      <div className={styles.wrap}>
        <section className={styles.hero}>
          <p className={styles.kicker}>About</p>
          <h1 className={styles.h1}>{SITE_NAME} delivers creative work to clients</h1>
          <p className={styles.lede}>
            One link for every delivery. Files that explain themselves. Downloads made for your client&rsquo;s phone. And proof of
            when they opened and saved the work.
          </p>
          <div className={styles.ctas}>
            <Button href="/signup" size="lg">
              Send your first delivery free
            </Button>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="facts">
          <h2 id="facts" className={styles.h2}>
            {SITE_NAME} in short
          </h2>
          <ul className={styles.grid}>
            {facts.map((fact) => (
              <li key={fact.title} className={styles.card}>
                <h3>{fact.title}</h3>
                <p>{fact.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="faq">
          <h2 id="faq" className={styles.h2}>
            Questions about {SITE_NAME}
          </h2>
          <Faq items={aboutFaqs} open={2} />
        </section>

        <section className={styles.section} aria-labelledby="for">
          <h2 id="for" className={styles.h2}>
            {SITE_NAME} for every kind of creative
          </h2>
          <ul className={styles.links}>
            {audiences.map((a) => (
              <li key={a.slug}>
                <Link href={`/for/${a.slug}`}>{a.name}</Link>
              </li>
            ))}
            <li>
              <Link href="/photo-enhancer">Free photo enhancer</Link>
            </li>
            <li>
              <Link href="/contact">Contact</Link>
            </li>
          </ul>
        </section>
      </div>
    </MarketingPage>
  );
}
