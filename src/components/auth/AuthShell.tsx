import Link from "next/link";
import { Logo } from "../Logo";
import { PhoneMock } from "../Mockups";
import styles from "./AuthShell.module.css";

type AuthShellProps = {
  title: string;
  lede: string;
  children: React.ReactNode;
  footer: React.ReactNode;
};

// Two-column layout for login and signup: the form on the left, the client's view on the right.
export function AuthShell({ title, lede, children, footer }: AuthShellProps) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" aria-label="Memocraft home">
          <Logo className={styles.logo} />
        </Link>
      </header>
      <main className={styles.main}>
        <div className={styles.formSide}>
          <div className={styles.card}>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.lede}>{lede}</p>
            {children}
            <p className={styles.footer}>{footer}</p>
          </div>
        </div>
        <aside className={styles.showcase} aria-hidden="true">
          <PhoneMock className={styles.phone} />
          <p className={styles.showcaseText}>Your client opens it on their phone. You see the moment they do.</p>
        </aside>
      </main>
    </div>
  );
}
