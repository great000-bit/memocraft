import Link from "next/link";
import { audiences } from "@/lib/site";
import { Logo } from "./Logo";
import styles from "./MarketingFooter.module.css";

const columns = [
  {
    head: "Product",
    links: [
      { label: "Deliveries", href: "/#features" },
      { label: "Proof of delivery", href: "/#proof" },
      { label: "Photo enhancer", href: "/photo-enhancer" },
      { label: "Questions", href: "/#faq" },
    ],
  },
  { head: "For", links: audiences.map((a) => ({ label: a.name, href: `/for/${a.slug}` })) },
  {
    head: "Company",
    links: [
      { label: "Create an account", href: "/signup" },
      { label: "Log in", href: "/login" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
];

// The footer of every marketing page. Real links to every public page, so people and crawlers can reach them all.
export function MarketingFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <Logo className={styles.logo} />
          <p className={styles.small}>Deliver work your clients understand.</p>
        </div>
        {columns.map((col) => (
          <nav key={col.head} className={styles.col} aria-label={col.head}>
            <p className={styles.head}>{col.head}</p>
            <ul>
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <p className={`${styles.small} ${styles.copy}`}>&copy; 2026 Memocraft</p>
    </footer>
  );
}
