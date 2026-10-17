import { Button } from "@/components/Button";
import { FeatureIcon, type FeatureIconName } from "@/components/FeatureIcons";
import { FeatureTabs } from "@/components/FeatureTabs";
import { Logo, LogoMark } from "@/components/Logo";
import { DeliveryMock } from "@/components/Mockups";
import { Phone } from "@/components/Phone";
import { Reveal } from "@/components/Reveal";
import { SiteNav } from "@/components/SiteNav";
import styles from "./page.module.css";

const audiences = ["Photographers", "Designers", "Filmmakers", "Brand studios", "Illustrators", "Videographers"];

const extras: { title: string; body: string; icon: FeatureIconName; tone: "mint" | "sand" | "amber" }[] = [
  { title: "Passwords and expiry", body: "Lock a delivery with a password, or let it close on a date you choose.", icon: "lock", tone: "mint" },
  { title: "Your brand on every page", body: "Your logo and studio name lead, so clients see you first.", icon: "brand", tone: "sand" },
  { title: "File requests", body: "Clients ask for a missing file, and it lands on your to-do list.", icon: "request", tone: "amber" },
  { title: "Version history", body: "Every replaced file is kept, so nothing is ever lost.", icon: "history", tone: "sand" },
  { title: "Big files, no fuss", body: "Uploads pause and resume on a weak connection.", icon: "upload", tone: "amber" },
  { title: "Collaborators", body: "Invite a second shooter or editor to help on a delivery.", icon: "people", tone: "mint" },
];

const footer = [
  { head: "Products", links: ["Deliveries", "Client links", "File requests", "Proof of delivery"] },
  { head: "Solutions", links: ["Photographers", "Designers", "Filmmakers", "Brand studios"] },
  { head: "Company", links: ["About", "Pricing", "Contact", "Privacy"] },
];

export default function Home() {
  return (
    <>
      <SiteNav />

      <main>
        <section className={styles.hero}>
          <Reveal className={styles.heroText}>
            <h1 className={styles.display}>Deliver work your clients understand</h1>
            <p className={styles.lede}>
              One link with every finished file in it. Your client opens a clean page on any phone, and you see the
              moment they download.
            </p>
            <div className={styles.ctas}>
              <Button href="/signup" size="lg">
                Try Memocraft free
              </Button>
            </div>
            <p className={styles.fine}>Free to start. No card needed. Your clients never need an account.</p>
          </Reveal>
          <Reveal effect="scale" delay={150} className={styles.heroMedia}>
            <div id="example" className={styles.heroStack}>
              <DeliveryMock />
              <Phone label="A delivery on an iPhone with Save to phone" className={styles.heroPhone} tilt>
                <div className={styles.phoneInner}>
                  <p className={styles.phoneStudio}>Lumen Studio</p>
                  <p className={styles.phoneTitle}>Adaeze &amp; Tobi</p>
                  <div className={styles.phoneGrid}>
                    {[0, 1, 2, 3].map((n) => (
                      <i key={n} className={styles[`tone${n}`]} />
                    ))}
                  </div>
                  <span className={styles.phoneSave}>Save to phone</span>
                </div>
              </Phone>
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
            <h2 className={styles.h2}>Everything a shared folder forgets</h2>
          </Reveal>
          <Reveal delay={100}>
            <FeatureTabs />
          </Reveal>
        </section>

        <section className={styles.section} id="proof">
          <div className={styles.split}>
            <Reveal className={styles.splitText}>
              <p className={styles.kicker}>Proof of delivery</p>
              <h2 className={styles.h2}>Know they got it, and when</h2>
              <p className={styles.body}>
                Every delivery shows whether it has been opened, and which files were downloaded. Fix a file later and
                the same link updates, marked Updated.
              </p>
              <Button href="/signup" variant="outline">
                Start free
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
            <h2 className={styles.panelTitle}>Private by default</h2>
            <p className={styles.panelBody}>
              Lock a delivery with a password, set when it closes, and pause any link in one tap. Clients who are
              turned away get a way to ask you for access, never a dead page.
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
              <span className={styles.cTile} />
              <span className={styles.cPhoto}>
                <span className={styles.cShare}>Share</span>
              </span>
              <div className={styles.cModal}>
                <p className={styles.lockTitle}>Link settings</p>
                <div className={styles.lockRow}>
                  <span>Password</span>
                  <span className={styles.toggleOn} />
                </div>
                <div className={styles.lockRow}>
                  <span>Closes</span>
                  <span className={styles.lockValue}>31 Dec 2026</span>
                </div>
                <div className={styles.lockRow}>
                  <span>Downloads</span>
                  <span className={styles.lockValue}>Allowed</span>
                </div>
                <div className={styles.lockRow}>
                  <span>Link</span>
                  <span className={styles.toggleOn} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <Reveal className={styles.sectionHead}>
            <p className={styles.kicker}>More</p>
            <h2 className={styles.h2}>There when you need it</h2>
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
                <h3 className={styles.stepTitle}>Drop your files</h3>
                <p className={styles.stepBody}>Drag in the finished work and give the delivery a name.</p>
              </div>
              <div className={styles.drop} aria-hidden="true">
                <span className={styles.dropIcon}>
                  <FeatureIcon name="upload" />
                </span>
                <ul className={styles.chips}>
                  <li>ceremony-001.jpg</li>
                  <li>launch-film.mp4</li>
                  <li>brand-guide.pdf</li>
                </ul>
              </div>
            </li>
            <li className={styles.stepCard} data-tone="amber">
              <span className={styles.stepNum}>2</span>
              <div className={styles.stepText}>
                <h3 className={styles.stepTitle}>Copy the link</h3>
                <p className={styles.stepBody}>Send it by email or WhatsApp. Your client opens it with no sign-up.</p>
              </div>
              <div className={styles.linkBox} aria-hidden="true">
                <div className={styles.linkPill}>
                  <span>memocraft.app/d/adaeze-tobi</span>
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
            <h2 className={styles.h2}>Made for every kind of creative</h2>
            <p className={styles.lede}>Wedding photographers, brand designers, filmmakers and studios use the same simple flow.</p>
          </Reveal>
          <Reveal delay={100}>
            <ul className={styles.tags}>
              {audiences.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </Reveal>
        </section>

        <section className={styles.final} id="pricing">
          <Reveal className={styles.finalInner}>
            <LogoMark className={styles.finalMark} />
            <h2 className={styles.finalTitle}>Your next delivery, done properly</h2>
            <div className={styles.ctas}>
              <Button href="/signup" size="lg">
                Try Memocraft free
              </Button>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <Logo className={styles.footerLogo} />
            <p className={styles.small}>Deliver work your clients understand.</p>
          </div>
          {footer.map((col) => (
            <div key={col.head} className={styles.footerCol}>
              <p className={styles.footerHead}>{col.head}</p>
              <ul>
                {col.links.map((l) => (
                  <li key={l}>
                    <a href="#">{l}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className={`${styles.small} ${styles.copy}`}>&copy; 2026 Memocraft</p>
      </footer>
    </>
  );
}
