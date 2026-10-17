import Link from "next/link";
import { Logo } from "../Logo";
import styles from "./LegalPage.module.css";

type LegalPageProps = { title: string; updated?: string; children: React.ReactNode };

// Plain reading layout for the privacy policy and terms.
export function LegalPage({ title, updated, children }: LegalPageProps) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" aria-label="Memocraft home">
          <Logo className={styles.logo} />
        </Link>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>{title}</h1>
        {updated && <p className={styles.updated}>Last updated {updated}</p>}
        <div className={styles.body}>{children}</div>
      </main>
      <footer className={styles.footer}>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <span>&copy; 2026 Memocraft</span>
      </footer>
    </div>
  );
}
