"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import styles from "./AuthForm.module.css";

type AuthFormProps = {
  mode: "login" | "signup";
  // Set by the page from what the server has keys for, so a button never promises something that cannot work.
  resetEnabled?: boolean;
  googleEnabled?: boolean;
};

type AuthError = { status: number; code?: string; message?: string };

function describe(error: AuthError, mode: AuthFormProps["mode"]) {
  if (error.status === 429) return "Too many attempts. Wait a few seconds and try again.";
  if (error.code === "USER_ALREADY_EXISTS" || error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
    return "An account with this email already exists. Log in instead.";
  }
  if (error.code === "INVALID_EMAIL_OR_PASSWORD") return "That email and password do not match.";
  if (error.code === "PASSWORD_TOO_SHORT") return "Use at least 8 characters for your password.";
  if (error.status >= 500) return "Something went wrong on our side. Try again in a moment.";
  return error.message || (mode === "signup" ? "We could not create your account." : "We could not log you in.");
}

// Email and password form. It talks to /api/auth so the sign-in attempt limits apply.
export function AuthForm({ mode, resetEnabled = false, googleEnabled = false }: AuthFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const signup = mode === "signup";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const name = String(data.get("name") ?? "").trim();

    setError(null);
    setPending(true);
    try {
      const result = signup
        ? await authClient.signUp.email({ name, email, password })
        : await authClient.signIn.email({ email, password });
      if (result.error) {
        setError(describe(result.error as AuthError, mode));
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("We could not reach Memocraft. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  async function continueWithGoogle() {
    setError(null);
    setPending(true);
    try {
      const result = await authClient.signIn.social({ provider: "google", callbackURL: "/dashboard" });
      if (result.error) {
        setError("We could not start Google sign-in. Try again, or use your email.");
        setPending(false);
      }
    } catch {
      setError("We could not reach Memocraft. Check your connection and try again.");
      setPending(false);
    }
  }

  return (
    <>
      {googleEnabled && (
        <div className={styles.social}>
          <button type="button" className={styles.google} onClick={continueWithGoogle} disabled={pending}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M23 12.27c0-.8-.07-1.57-.2-2.3H12v4.35h6.17a5.28 5.28 0 0 1-2.29 3.46v2.87h3.7C21.74 18.65 23 15.7 23 12.27z" />
              <path fill="#34A853" d="M12 23.5c3.1 0 5.7-1.03 7.58-2.8l-3.7-2.87c-1.03.69-2.34 1.1-3.88 1.1-2.98 0-5.5-2.01-6.4-4.72H1.78v2.96A11.5 11.5 0 0 0 12 23.5z" />
              <path fill="#FBBC05" d="M5.6 14.21a6.9 6.9 0 0 1 0-4.42V6.83H1.78a11.5 11.5 0 0 0 0 10.34l3.82-2.96z" />
              <path fill="#EA4335" d="M12 5.07c1.69 0 3.2.58 4.39 1.72l3.29-3.29C17.7 1.64 15.1.5 12 .5 7.5.5 3.63 3.08 1.78 6.83l3.82 2.96C6.5 7.08 9.02 5.07 12 5.07z" />
            </svg>
            Continue with Google
          </button>
          <p className={styles.or}>
            <span>or use your email</span>
          </p>
        </div>
      )}
      <form className={styles.form} onSubmit={onSubmit}>
        {signup && (
          <div className={styles.field}>
            <label htmlFor="name">Your name</label>
            <input id="name" name="name" type="text" autoComplete="name" required maxLength={80} />
          </div>
        )}
        <div className={styles.field}>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
        </div>
        <div className={styles.field}>
          <div className={styles.labelRow}>
            <label htmlFor="password">Password</label>
            {!signup && resetEnabled && (
              <Link href="/forgot-password" className={styles.forgot}>
                Forgot password?
              </Link>
            )}
          </div>
          <div className={styles.passwordWrap}>
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete={signup ? "new-password" : "current-password"}
              required
              minLength={signup ? 8 : undefined}
              maxLength={128}
              aria-describedby={signup ? "password-hint" : undefined}
            />
            <button
              type="button"
              className={styles.reveal}
              onClick={() => setShowPassword((v) => !v)}
              aria-pressed={showPassword}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          {signup && (
            <p id="password-hint" className={styles.hint}>
              At least 8 characters.
            </p>
          )}
        </div>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <button type="submit" className={styles.submit} disabled={pending}>
          {pending ? (signup ? "Creating your account…" : "Logging in…") : signup ? "Create free account" : "Log in"}
        </button>

        {signup && <p className={styles.fine}>Free to start. No card needed.</p>}
        {!signup && !resetEnabled && <p className={styles.fine}>Password reset by email is coming soon.</p>}
      </form>
    </>
  );
}
