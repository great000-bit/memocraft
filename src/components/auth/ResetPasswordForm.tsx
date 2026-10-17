"use client";

import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import styles from "./AuthForm.module.css";

// The page a reset email opens. The token in the address proves the email arrived; it works once.
export function ResetPasswordForm({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [shown, setShown] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const newPassword = String(new FormData(event.currentTarget).get("password") ?? "");
    setError(null);
    setPending(true);
    try {
      const result = await authClient.resetPassword({ newPassword, token });
      if (!result.error) {
        setDone(true);
      } else if (result.error.code === "INVALID_TOKEN") {
        setError("This link has expired or was already used. Ask for a new one.");
      } else if (result.error.code === "PASSWORD_TOO_SHORT") {
        setError("Use at least 8 characters for your password.");
      } else {
        setError(result.error.message || "We could not change your password. Try again.");
      }
    } catch {
      setError("We could not reach Memocraft. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className={styles.form}>
        <p className={styles.notice} role="status">
          Your password is changed. Every other device was signed out.
        </p>
        <Link href="/login" className={styles.submit} style={{ textAlign: "center", lineHeight: "56px", textDecoration: "none" }}>
          Log in
        </Link>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <div className={styles.field}>
        <label htmlFor="password">New password</label>
        <div className={styles.passwordWrap}>
          <input
            id="password"
            name="password"
            type={shown ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            autoFocus
          />
          <button type="button" className={styles.reveal} onClick={() => setShown((value) => !value)} aria-pressed={shown}>
            {shown ? "Hide" : "Show"}
          </button>
        </div>
        <p className={styles.hint}>At least 8 characters.</p>
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}{" "}
          {error.includes("Ask for a new one") && (
            <Link href="/forgot-password" className={styles.forgot}>
              Send a new link
            </Link>
          )}
        </p>
      )}
      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
