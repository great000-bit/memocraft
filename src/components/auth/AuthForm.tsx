"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import styles from "./AuthForm.module.css";

type AuthFormProps = { mode: "login" | "signup" };

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
export function AuthForm({ mode }: AuthFormProps) {
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

  return (
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
        <label htmlFor="password">Password</label>
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
      {!signup && <p className={styles.fine}>Password reset by email is coming soon.</p>}
    </form>
  );
}
