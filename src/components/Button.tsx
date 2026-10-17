import Link from "next/link";
import styles from "./Button.module.css";

type ButtonProps = {
  href: string;
  variant?: "primary" | "secondary" | "outline" | "link" | "quiet";
  size?: "md" | "lg";
  arrow?: boolean;
  children: React.ReactNode;
};

// Animated call-to-action link. The landing page is silent: sounds belong to the workspace only.
export function Button({ href, variant = "primary", size = "md", arrow, children }: ButtonProps) {
  const showArrow = arrow ?? (variant === "primary" || variant === "outline" || variant === "link");
  return (
    <Link href={href} className={`${styles.button} ${styles[variant]} ${styles[size]}`}>
      <span className={styles.label}>{children}</span>
      {showArrow && (
        <svg className={styles.arrow} viewBox="0 0 16 16" aria-hidden="true">
          <path d="M2.5 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </Link>
  );
}
