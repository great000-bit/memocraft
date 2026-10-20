import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/Button";
import { GetAppButton } from "@/components/GetAppButton";
import { FeatureIcon, type FeatureIconName } from "@/components/FeatureIcons";
import { EnhancerShowcase } from "@/components/EnhancerShowcase";
import { FeatureTabs } from "@/components/FeatureTabs";
import { HeroHook } from "@/components/HeroHook";
import { Faq, faqJsonLd } from "@/components/Faq";
import { JsonLd } from "@/components/JsonLd";
import { LogoMark } from "@/components/Logo";
import { MarketingFooter } from "@/components/MarketingFooter";
import { HeroDemo } from "@/components/HeroDemo";
import { SmoothScroll } from "@/components/SmoothScroll";
import { Photo } from "@/components/Photo";
import type { PhotoKey } from "@/components/photos";
import { Reveal } from "@/components/Reveal";
import { SiteNav } from "@/components/SiteNav";
import { audiences as trades, homeFaqs, SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL, socialFor } from "@/lib/site";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: { absolute: `${SITE_NAME}: client file delivery with proof of download` },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  ...socialFor("/", `${SITE_NAME}: ${SITE_TAGLINE}`, SITE_DESCRIPTION),
};

const schema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/icons/icon-512.png`,
      description: SITE_DESCRIPTION,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "en",
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#app`,
      name: SITE_NAME,
      url: SITE_URL,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, iOS, Android",
      description: SITE_DESCRIPTION,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "Free to start, no card" },
      featureList: [
        "One link for every client delivery",
        "Proof of delivery: when files were opened and downloaded",
        "Save photos straight to a phone",
        "Password, expiry and pause controls",
        "File requests from clients",
        "Free in-browser photo enhancer",
      ],
    },
  ],
};

const audiences = ["Photographers", "Designers", "Filmmakers", "Brand studios", "Illustrators", "Videographers"];

const extras: { title: string; body: string; icon: FeatureIconName; tone: "mint" | "sand" | "amber" }[] = [
  { title: "Passwords and expiry", body: "Set a password, or let the link close on a date you choose.", icon: "lock", tone: "mint" },
  { title: "Your name comes first", body: "Your logo and studio name lead the page, so clients remember who delivered.", icon: "brand", tone: "sand" },
  { title: "File requests", body: "Need the PNG, not the JPG? Your client asks in one tap and it lands on your to-do list.", icon: "request", tone: "amber" },
  { title: "Version history", body: "Replace a file and the old one is kept, so nothing is overwritten by mistake.", icon: "history", tone: "sand" },
  { title: "Big files, no fuss", body: "Uploads pause and resume, so hotel Wi-Fi after a shoot will not cost you the upload.", icon: "upload", tone: "amber" },
  { title: "Collaborators", body: "Bring in a second shooter or an editor to work on a delivery with you.", icon: "people", tone: "mint" },
];

const galleryTiles: PhotoKey[] = ["printLaugh", "capFists", "purplePhone", "beretPhone"];

export default function Home() {
  return (
    <div className={`neu-scope ${styles.page}`}>
      <JsonLd data={schema} />
      <JsonLd data={faqJsonLd(homeFaqs)} />
      <SmoothScroll />
      <SiteNav />

      <main>
        <section className={styles.hero}>
          <div className={styles.heroGrid} aria-hidden="true" />
          <Reveal immediate className={styles.heroText}>
            <h1 className="sr-only">Send photos, videos and design files to clients with one link, and see when they open and download them</h1>
            <HeroHook className={styles.display} accentClassName={styles.displayAccent} />
            <p className={styles.heroLede}>Every finished file, labelled, in one link. You see when it&rsquo;s opened.</p>
            <div className={styles.ctas}>
              <Button href="/signup" size="lg">
                Send your first delivery free
              </Button>
              <GetAppButton />
            </div>
            <p className={styles.fine}>No card. No zip files. Your clients never make an account.</p>
          </Reveal>

          {/* The client's phone in the middle, with the proof of delivery floating round it. */}
          <Reveal immediate effect="scale" delay={150} className={styles.heroStage}>
            <div id="example" className={styles.stage}>
              <HeroDemo className={styles.heroPhone} />
              <div className={`${styles.float} ${styles.floatPill}`} aria-hidden="true">
                <span className={styles.floatDot} />
                Opened 2 min ago
              </div>
              <div className={`${styles.float} ${styles.floatLeft}`} aria-hidden="true">
                <p className={styles.floatLabel}>Downloaded</p>
                <p className={styles.floatFigure}>12 of 12</p>
                <p className={styles.floatNote}>
                  <span className={styles.floatTick}>✓</span> every file saved
                </p>
              </div>
              <div className={`${styles.float} ${styles.floatRight}`} aria-hidden="true">
                <p className={styles.floatLabel}>Delivered</p>
                <p className={styles.floatFigure}>Mon 09:44</p>
              </div>
              <div className={styles.floatCard} aria-hidden="true">
                <LogoMark className={styles.floatCardMark} />
                <p className={styles.floatCardName}>Lumen Studio</p>
                <p className={styles.floatCardSub}>Spring Lookbook</p>
              </div>
            </div>
          </Reveal>
        </section>

        <section className={styles.strip} aria-label="Who uses Memocraft">
          <ul className={styles.marquee}>
            {[...audiences, ...audiences].map((a, i) => (
              <li key={`${a}-${i}`} aria-hidden={i >= audiences.length}>
                {a}
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section} id="features">
          <Reveal className={styles.sectionHead}>
            <p className={styles.kicker}>Features</p>
            <h2 className={styles.h2}>A shared folder isn&rsquo;t a delivery</h2>
          </Reveal>
          <Reveal delay={100}>
            <FeatureTabs />
          </Reveal>
        </section>

        <section className={styles.section} id="enhancer">
          <Reveal effect="scale">
            <EnhancerShowcase />
          </Reveal>
        </section>

        <section className={styles.section} id="proof">
          <div className={styles.split}>
            <Reveal className={styles.splitText}>
              <p className={styles.kicker}>Proof of delivery</p>
              <h2 className={styles.h2}>Never ask &ldquo;did you get it?&rdquo; again</h2>
              <p className={styles.body}>
                Every delivery shows whether it has been opened and which files were saved, with the time. When a client
                says they never got it, you already know the answer.
              </p>
              <Button href="/signup" variant="outline">
                Send your first delivery
              </Button>
            </Reveal>
            <Reveal effect="scale" delay={120} className={styles.splitMedia}>
              <div className={styles.statusCard}>
                <div className={styles.statusHead}>
                  <p className={styles.statusTitle}>Brand launch film</p>
                  <span className={styles.statusBadge}>Downloaded</span>
                </div>
                {[
                  ["Sent", "Kemi at Orbit Foods", "Mon 09:12"],
                  ["Opened", "From Lagos, on iPhone", "Mon 09:40"],
                  ["Downloaded", "launch-film-4k.mp4", "Mon 09:44"],
                  ["Updated", "Subtitles fixed, same link", "Tue 14:03"],
                ].map(([what, detail, when]) => (
                  <div key={what} className={styles.statusRow}>
                    <span className={styles.statusDot} data-kind={what} aria-hidden="true" />
                    <div>
                      <p className={styles.statusWhat}>{what}</p>
                      <p className={styles.statusDetail}>{detail}</p>
                    </div>
                    <span className={styles.statusWhen}>{when}</span>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        <section className={styles.panelSection} id="privacy">
          <div className={styles.panel}>
            <span className={styles.panelIcon}>
              <FeatureIcon name="lock" />
            </span>
            <h2 className={styles.panelTitle}>Only the people you chose get in</h2>
            <p className={styles.panelBody}>
              Password-protect a delivery, set the day it closes, or pause the link in one tap. Anyone turned away
              sees who sent it and what to do next, not a dead page.
            </p>
            <div className={styles.panelCtas}>
              <Button href="/signup" variant="outline">
                Start free
              </Button>
              <Button href="#how" variant="link">
                Learn more
              </Button>
            </div>
            <div className={styles.collage} aria-hidden="true">
              <div className={`${styles.cCard} ${styles.cCover}`}>
                <span className={styles.coverPhoto}>
                  <Photo name="headphones" sizes="(min-width: 720px) 300px, 60vw" />
                </span>
                <p className={styles.coverName}>launch-film-4k.mp4</p>
                <span className={styles.chip}>Downloaded Mon 09:44</span>
              </div>
              <div className={`${styles.cCard} ${styles.cGallery}`}>
                <div className={styles.galleryHead}>
                  <div>
                    <p className={styles.galleryTitle}>Spring Lookbook</p>
                    <p className={styles.gallerySub}>Lookbook &middot; 48 files</p>
                  </div>
                  <span className={styles.cShare}>Share</span>
                </div>
                <div className={styles.galleryGrid}>
                  {galleryTiles.map((photo) => (
                    <i key={photo}>
                      <Photo name={photo} sizes="(min-width: 720px) 200px, 40vw" />
                    </i>
                  ))}
                </div>
                <p className={styles.galleryFoot}>
                  <b>Updated</b>
                  Retouched files replaced, same link
                </p>
              </div>
              <div className={`${styles.cCard} ${styles.cModal}`}>
                <div className={styles.modalBar}>
                  <span>&lsaquo; Back</span>
                  <span className={styles.modalIcons}>&#9881; &times;</span>
                </div>
                <p className={styles.lockTitle}>Link settings</p>
                <div className={styles.modalTabs}>
                  <b>People</b>
                  <span>Links</span>
                </div>
                {[
                  ["KO", "mint", "Kemi at Orbit Foods", "Opened 2 hours ago", "Can download"],
                  ["TA", "amber", "Tobi Adeyemi", "Not opened yet", "Can view"],
                  ["LS", "sand", "Lumen Studio", "You", "Owner"],
                ].map(([initials, tone, name, note, role]) => (
                  <div key={name} className={styles.person}>
                    <span className={styles.avatar} data-tone={tone}>
                      {initials}
                    </span>
                    <div>
                      <p className={styles.personName}>{name}</p>
                      <p className={styles.personNote}>{note}</p>
                    </div>
                    <span className={styles.personRole}>{role}</span>
                  </div>
                ))}
                <div className={styles.lockRow}>
                  <span>Password</span>
                  <span className={styles.toggleOn} />
                </div>
                <div className={styles.lockRow}>
                  <span>Closes</span>
                  <span className={styles.lockValue}>31 Dec 2026</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <Reveal className={styles.sectionHead}>
            <p className={styles.kicker}>More</p>
            <h2 className={styles.h2}>Small things that save you a message</h2>
          </Reveal>
          <ul className={styles.cards}>
            {extras.map((e) => (
              <li key={e.title} className={styles.card} data-tone={e.tone}>
                <span className={styles.cardIcon}>
                  <FeatureIcon name={e.icon} />
                </span>
                <div className={styles.cardText}>
                  <h3 className={styles.cardTitle}>{e.title}</h3>
                  <p className={styles.cardBody}>{e.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section} id="how">
          <Reveal className={styles.sectionHead}>
            <p className={styles.kicker}>How it works</p>
            <h2 className={styles.h2}>Two steps to send</h2>
          </Reveal>
          <ol className={styles.steps}>
            <li className={styles.stepCard} data-tone="mint">
              <span className={styles.stepNum}>1</span>
              <div className={styles.stepText}>
                <h3 className={styles.stepTitle}>Drop in the finished work</h3>
                <p className={styles.stepBody}>Drag in the files, name the delivery, and add a note wherever it helps.</p>
              </div>
              <div className={styles.drop} aria-hidden="true">
                <span className={styles.dropIcon}>
                  <FeatureIcon name="upload" />
                </span>
                <ul className={styles.chips}>
                  <li>hero-001.jpg</li>
                  <li>launch-film.mp4</li>
                  <li>brand-guide.pdf</li>
                </ul>
              </div>
            </li>
            <li className={styles.stepCard} data-tone="amber">
              <span className={styles.stepNum}>2</span>
              <div className={styles.stepText}>
                <h3 className={styles.stepTitle}>Send one link</h3>
                <p className={styles.stepBody}>Paste it into email or WhatsApp. Your client opens it on any device with no sign-up.</p>
              </div>
              <div className={styles.linkBox} aria-hidden="true">
                <div className={styles.linkPill}>
                  <span>memocraft.app/d/spring-lookbook</span>
                  <b>Copy</b>
                </div>
                <p className={styles.linkNote}>Opened on iPhone, Mon 09:40</p>
              </div>
            </li>
          </ol>
        </section>

        <section className={styles.section} id="who">
          <Reveal className={styles.sectionHead}>
            <p className={styles.kicker}>Solutions</p>
            <h2 className={styles.h2}>Built for people who make things for clients</h2>
            <p className={styles.lede}>Four hundred photos, a brand kit or a 4K film: the delivery looks clear, carries your name, and opens without help.</p>
          </Reveal>
          <Reveal delay={100}>
            <ul className={styles.tags}>
              {trades.map((a) => (
                <li key={a.slug}>
                  <Link href={`/for/${a.slug}`}>{a.name}</Link>
                </li>
              ))}
            </ul>
          </Reveal>
        </section>

        <section className={styles.section} id="faq">
          <Reveal className={styles.sectionHead}>
            <p className={styles.kicker}>Questions</p>
            <h2 className={styles.h2}>Answers before you ask</h2>
          </Reveal>
          <Reveal delay={100}>
            <Faq items={homeFaqs} open={1} />
          </Reveal>
        </section>

        <section className={styles.final} id="pricing">
          <Reveal className={styles.finalInner}>
            <LogoMark className={styles.finalMark} />
            <h2 className={styles.finalTitle}>The handover is part of the work</h2>
            <div className={styles.ctas}>
              <Button href="/signup" size="lg">
                Send your first delivery free
              </Button>
            </div>
          </Reveal>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
