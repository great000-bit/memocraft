import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { AuthShell } from "@/components/auth/AuthShell";
import { emailConfigured } from "@/lib/email";
import styles from "@/components/auth/AuthForm.module.css";

export const metadata: Metadata = { title: "Reset your password | Memocraft" };

export default function ForgotPasswordPage() {
  const ready = emailConfigured();
  return (
    <AuthShell
      title="Reset your password"
      lede={ready ? "Enter the email you signed up with and we will send you a link." : "Password reset by email is not switched on yet."}
      footer={
        <>
          Remembered it? <Link href="/login">Log in</Link>
        </>
      }
    >
      {ready ? <ForgotPasswordForm /> : <p className={styles.fine}>Check back soon, or log in if you still have your password.</p>}
    </AuthShell>
  );
}
