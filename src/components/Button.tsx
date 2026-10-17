import Link from "next/link";
import styles from "./Button.module.css";

type ButtonProps = {
  href: string;
  variant?: "primary" | "secondary" | "quiet";
  children: React.ReactNode;
};

// Animated call-to-action link. The landing page is silent: sounds belong to the workspace only.
export function Button({ href, variant = "primary", children }: ButtonProps) {
  return (
    <Link href={href} className={`${styles.button} ${styles[variant]}`}>
      <span className={styles.label}>{children}</span>
      {variant === "primary" && (
        <svg className={styles.arrow} viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </Link>
  );
}
