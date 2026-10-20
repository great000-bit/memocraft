import Link from "next/link";
import { Button } from "./Button";
import { Logo } from "./Logo";
import { MobileMenu } from "./MobileMenu";
import styles from "./SiteNav.module.css";

const products = [
  { label: "Deliveries", href: "/#features", note: "One link for every client" },
  { label: "Client links", href: "/#features", note: "Pause, expire or protect any link" },
  { label: "File requests", href: "/#features", note: "Let clients ask for what's missing" },
  { label: "Proof of delivery", href: "/#proof", note: "See who opened and downloaded" },
];

const solutions = [
  { label: "Photographers", href: "/for/photographers" },
  { label: "Videographers", href: "/for/videographers" },
  { label: "Designers", href: "/for/designers" },
  { label: "Filmmakers", href: "/for/filmmakers" },
  { label: "Brand studios", href: "/for/brand-studios" },
];

const mobileLinks = [
  ...products.map(({ label, href }) => ({ label, href })),
  { label: "Photo enhancer", href: "/photo-enhancer" },
  ...solutions.map(({ label, href }) => ({ label, href })),
  { label: "Questions", href: "/#faq" },
  { label: "Example", href: "/#example" },
  { label: "Contact", href: "/contact" },
  { label: "Log in", href: "/login" },
];

// Top navigation. Dropdowns are native <details> elements, so they work without JavaScript.
export function SiteNav() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label="Memocraft home">
          <Logo className={styles.logo} />
        </Link>

        <nav className={styles.nav} aria-label="Main">
          <details className={styles.menu}>
            <summary>
              Products
              <Chevron />
            </summary>
            <div className={styles.panel}>
              {products.map((p) => (
                <a key={p.label} href={p.href} className={styles.item}>
                  <span className={styles.itemTitle}>{p.label}</span>
                  <span className={styles.itemNote}>{p.note}</span>
                </a>
              ))}
            </div>
          </details>

          <details className={styles.menu}>
            <summary>
              Solutions
              <Chevron />
            </summary>
            <div className={`${styles.panel} ${styles.panelNarrow}`}>
              {solutions.map((s) => (
                <a key={s.label} href={s.href} className={styles.item}>
                  <span className={styles.itemTitle}>{s.label}</span>
                </a>
              ))}
            </div>
          </details>

          <a href="/photo-enhancer" className={styles.link}>
            Photo enhancer
          </a>
          <Link href="/#example" className={styles.link}>
            Example
          </Link>
          <Link href="/contact" className={styles.link}>
            Contact
          </Link>
        </nav>

        <div className={styles.actions}>
          <Button href="/login" variant="quiet">
            Log in
          </Button>
          <Button href="/signup" variant="primary">
            Get started
          </Button>
        </div>
        <MobileMenu links={mobileLinks} />
      </div>
    </header>
  );
}

function Chevron() {
  return (
    <svg className={styles.chevron} viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
