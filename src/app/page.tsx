import Link from "next/link";
import { Button } from "@/components/Button";
import { FeatureTabs } from "@/components/FeatureTabs";
import { Logo, LogoMark } from "@/components/Logo";
import { DeliveryMock } from "@/components/Mockups";
import { Reveal } from "@/components/Reveal";
import styles from "./page.module.css";

const extras = [
  { title: "Passwords and expiry", body: "Lock a delivery or let it close on a date you choose." },
  { title: "Your brand on every page", body: "Your logo and studio name, so clients see you, not us." },
  { title: "File requests", body: "Clients ask for a missing file and it lands on your to-do list." },
  { title: "Version history", body: "Every replaced file is kept, so nothing is ever lost." },
  { title: "Big files, no fuss", body: "Uploads pause and resume on a weak connection." },
  { title: "Collaborators", body: "Invite a second shooter or editor to help on a delivery." },
];

const audiences = ["Photographers", "Designers", "Filmmakers", "Brand studios", "Illustrators", "Videographers"];

const footer = [
  { head: "Product", links: ["Features", "Example delivery", "Pricing"] },
  { head: "For", links: ["Photographers", "Designers", "Filmmakers"] },
  { head: "Company", links: ["About", "Contact", "Privacy"] },
];

export default function Home() {
  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.brand} aria-label="Memocraft home">
            <Logo className={styles.logo} />
          </Link>
          <nav className={styles.links} aria-label="Main">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#who">Who it&rsquo;s for</a>
          </nav>
          <div className={styles.actions}>
            <Button href="/login" variant="quiet">
              Log in
            </Button>
            <Button href="/signup">Start free</Button>
          </div>
        </div>
      </header>

      <main>
        <section className={styles.hero}>
          <Reveal className={styles.heroText}>
            <h1 className={styles.display}>Deliver work your clients understand</h1>
          </Reveal>
          <Reveal className={styles.heroSub} delay={120}>
            <p className={styles.lede}>
              One clean link for every delivery. Labelled files, proof they arrived, and downloads made for your
              client&rsquo;s phone.
            </p>
            <div className={styles.ctas}>
              <Button href="/signup">Start free</Button>
              <Button href="#example" variant="secondary">
                See an example
              </Button>
            </div>
          </Reveal>
          <Reveal effect="scale" delay={240} className={styles.heroMedia}>
            <div id="example">
              <DeliveryMock />
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
            <h2 className={styles.h2}>Everything a shared folder forgets</h2>
            <p className={styles.lede}>Three things clients notice the first time they open a Memocraft link.</p>
          </Reveal>
          <Reveal delay={100}>
            <FeatureTabs />
          </Reveal>
        </section>

        <section className={styles.band}>
          <div className={styles.bandInner}>
            <Reveal>
              <p className={styles.bandKicker}>One link. Always current.</p>
            </Reveal>
            <Reveal delay={100}>
              <h2 className={styles.bandTitle}>
                Fix a file after you send it. Your client&rsquo;s link updates, and you know they&rsquo;ve seen it.
              </h2>
            </Reveal>
            <div className={styles.stats}>
              {["Not opened", "Opened", "Downloaded"].map((s, i) => (
                <Reveal key={s} delay={200 + i * 120} className={styles.stat}>
                  <span className={styles.statDot} data-step={i} aria-hidden="true" />
                  <span>{s}</span>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.section} id="how">
          <Reveal className={styles.sectionHead}>
            <h2 className={styles.h2}>Two steps to send</h2>
          </Reveal>
          <ol className={styles.steps}>
            {[
              ["Drop your files", "Drag in the finished work and give the delivery a name."],
              ["Copy the link", "Send it by email or WhatsApp. Your client opens it with no sign-up."],
            ].map(([title, body], i) => (
              <Reveal as="li" key={title} delay={i * 120} className={styles.step}>
                <span className={styles.stepNum}>{i + 1}</span>
                <h3 className={styles.h3}>{title}</h3>
                <p className={styles.body}>{body}</p>
              </Reveal>
            ))}
          </ol>
        </section>

        <section className={styles.section}>
          <Reveal className={styles.sectionHead}>
            <h2 className={styles.h2}>There when you need it</h2>
          </Reveal>
          <ul className={styles.extras}>
            {extras.map((e, i) => (
              <Reveal as="li" key={e.title} delay={(i % 3) * 100} className={styles.extra}>
                <h3 className={styles.h3}>{e.title}</h3>
                <p className={styles.body}>{e.body}</p>
              </Reveal>
            ))}
          </ul>
        </section>

        <section className={styles.section} id="who">
          <Reveal className={styles.sectionHead}>
            <h2 className={styles.h2}>Made for every kind of creative</h2>
            <p className={styles.lede}>
              Wedding photographers, brand designers, filmmakers and studios use the same simple flow.
            </p>
          </Reveal>
          <Reveal delay={100}>
            <ul className={styles.tags}>
              {audiences.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </Reveal>
        </section>

        <section className={styles.final}>
          <Reveal className={styles.finalInner}>
            <LogoMark className={styles.finalMark} />
            <h2 className={styles.finalTitle}>Your next delivery, done properly</h2>
            <Button href="/signup">Start free</Button>
            <p className={styles.finalNote}>Your clients never need an account.</p>
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
