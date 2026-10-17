import Link from "next/link";
import { Button } from "@/components/Button";
import { Logo, LogoMark } from "@/components/Logo";
import styles from "./page.module.css";

const features = [
  {
    title: "Files that explain themselves",
    body: "Group files into sections and add a short note to each, like “For print” or “For Instagram”. Your client knows which file is which without asking you.",
  },
  {
    title: "One link that stays current",
    body: "Replace a file and the same link shows the new version, marked Updated. You see when your client opened it and what they downloaded.",
  },
  {
    title: "Made for your client’s phone",
    body: "Clients save straight to their camera roll, pick favourites and ask for a missing file. No account, no app, no zip they cannot open.",
  },
];

const steps = [
  { title: "Drop your files", body: "Drag in the finished work and give the delivery a name." },
  { title: "Copy the link", body: "Send it by email or WhatsApp. Your client opens it, no sign-up needed." },
];

const audiences = ["Photographers", "Designers", "Filmmakers", "Brand studios", "Illustrators", "Videographers"];

export default function Home() {
  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.brand} aria-label="Memocraft home">
            <Logo className={styles.logo} />
          </Link>
          <nav className={styles.nav} aria-label="Main">
            <Button href="#example" variant="quiet">
              See an example
            </Button>
            <Button href="/login" variant="quiet">
              Log in
            </Button>
            <Button href="/signup">Start free</Button>
          </nav>
        </div>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.heroText}>
            <p className={styles.eyebrow}>For creatives who deliver to clients</p>
            <h1 className={styles.headline}>Deliver work your clients understand.</h1>
            <p className={styles.lede}>
              Memocraft turns a folder of finished files into one clean page your client can open on any phone. Every file is
              labelled, the link stays current, and you know the moment they download.
            </p>
            <div className={styles.ctas}>
              <Button href="/signup">Start free</Button>
              <Button href="#example" variant="secondary">
                See an example delivery
              </Button>
            </div>
            <p className={styles.small}>Your clients never need an account.</p>
          </div>

          <div className={styles.compare} id="example">
            <figure className={`${styles.panel} ${styles.before}`}>
              <figcaption className={styles.panelLabel}>Before</figcaption>
              <ul className={styles.mess}>
                <li>
                  <span className={styles.mono}>final_v3_FINAL(2).zip</span>
                  <span className={styles.expired}>Link expired</span>
                </li>
                <li>
                  <span className={styles.mono}>IMG_4471.CR3</span>
                  <span className={styles.muted}>Can&rsquo;t open on phone</span>
                </li>
                <li className={styles.bubble}>&ldquo;Which one is for print??&rdquo;</li>
                <li className={styles.bubble}>&ldquo;Did you get the files?&rdquo;</li>
              </ul>
            </figure>

            <figure className={`${styles.panel} ${styles.after}`}>
              <figcaption className={styles.panelLabel}>With Memocraft</figcaption>
              <div className={styles.delivery}>
                <div className={styles.deliveryHead}>
                  <div>
                    <p className={styles.deliveryTitle}>Adaeze &amp; Tobi, wedding</p>
                    <p className={styles.muted}>From Lumen Studio &middot; 48 files</p>
                  </div>
                  <span className={styles.status}>
                    <span className={styles.dot} aria-hidden="true" /> Downloaded
                  </span>
                </div>
                <ul className={styles.sections}>
                  <li>
                    <span className={styles.thumbs} aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                    <span>
                      <b>Ceremony</b>
                      <span className={styles.note}>Full resolution, for print</span>
                    </span>
                  </li>
                  <li>
                    <span className={styles.thumbs} aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                    <span>
                      <b>For Instagram</b>
                      <span className={styles.note}>Cropped 4:5, ready to post</span>
                    </span>
                    <span className={styles.updated}>Updated</span>
                  </li>
                </ul>
                <span className={styles.save}>Save to phone</span>
              </div>
            </figure>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="features">
          <h2 id="features" className={styles.h2}>
            Better than a shared folder
          </h2>
          <div className={styles.features}>
            {features.map((f, i) => (
              <article key={f.title} className={styles.feature}>
                <span className={styles.num}>0{i + 1}</span>
                <h3 className={styles.h3}>{f.title}</h3>
                <p className={styles.body}>{f.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="how">
          <h2 id="how" className={styles.h2}>
            Two steps to send
          </h2>
          <ol className={styles.steps}>
            {steps.map((s, i) => (
              <li key={s.title} className={styles.step}>
                <span className={styles.stepNum}>{i + 1}</span>
                <div>
                  <h3 className={styles.h3}>{s.title}</h3>
                  <p className={styles.body}>{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className={styles.small}>Notes, passwords, expiry dates and your own branding are there when you want them.</p>
        </section>

        <section className={styles.section} aria-labelledby="who">
          <h2 id="who" className={styles.h2}>
            Made for every kind of creative
          </h2>
          <ul className={styles.tags}>
            {audiences.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </section>

        <section className={styles.final}>
          <LogoMark className={styles.finalMark} />
          <h2 className={styles.h2}>Your next delivery, done properly.</h2>
          <Button href="/signup">Start free</Button>
        </section>
      </main>

      <footer className={styles.footer}>
        <Logo className={styles.footerLogo} />
        <p className={styles.small}>&copy; 2026 Memocraft</p>
      </footer>
    </>
  );
}
