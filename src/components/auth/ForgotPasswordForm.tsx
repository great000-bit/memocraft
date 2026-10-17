"use client";

import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import styles from "./AuthForm.module.css";

// Asks for a reset link. The answer is the same whether or not an account has this address, so the form cannot be
// used to find out who is a customer.
export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    setError(null);
    setPending(true);
    try {
      const result = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
      if (result.error?.status === 429) setError("Too many tries. Wait a minute and try again.");
      else setSent(true);
    } catch {
      setError("We could not reach Memocraft. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className={styles.form}>
        <p className={styles.notice} role="status">
          If there is an account for that email, a reset link is on its way. It works for one hour. Check your spam folder if
          you do not see it.
        </p>
        <Link href="/login" className={styles.forgot}>
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <div className={styles.field}>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required autoFocus />
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
