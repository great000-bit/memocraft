"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { authClient } from "@/lib/auth-client";
import styles from "./AuthForm.module.css";

type AuthFormProps = {
  mode: "login" | "signup";
  // Set by the page from what the server has keys for, so a button never promises something that cannot work.
  googleEnabled?: boolean;
};

// Google sends people back here with ?error=<code> when it could not sign them in. The most likely cause is an
// older account for the same email that Google could not be linked to, so the person is told what happened
// instead of being left on a bare page.
function GoogleReturnNotice() {
  const code = useSearchParams().get("error");
  if (!code) return null;
  const message =
    code === "account_not_linked" || code === "unable_to_link_account"
      ? "This email already has a Memocraft account that Google could not be linked to. Contact us and we will sort it out."
      : code === "access_denied"
        ? "Google sign-in was cancelled. Try again when you are ready."
        : "Google sign-in did not finish. Try again.";
  return (
    <p className={styles.error} role="alert">
      {message}
    </p>
  );
}

// Google is the only way in; the same button signs up a new creative. It talks to /api/auth so the attempt limits apply.
export function AuthForm({ mode, googleEnabled = false }: AuthFormProps) {
  const pathname = usePathname();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function continueWithGoogle() {
    setError(null);
    setPending(true);
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/dashboard",
        newUserCallbackURL: "/dashboard",
        // A failed attempt comes back to this page, where GoogleReturnNotice explains it.
        errorCallbackURL: pathname,
      });
      if (result.error) {
        setError("We could not start Google sign-in. Try again in a moment.");
        setPending(false);
      }
    } catch {
      setError("We could not reach Memocraft. Check your connection and try again.");
      setPending(false);
    }
  }

  if (!googleEnabled) {
    return <p className={styles.fine}>Sign-in is being set up. Please check back shortly.</p>;
  }

  return (
    <div className={styles.social}>
      <Suspense fallback={null}>
        <GoogleReturnNotice />
      </Suspense>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <button type="button" className={styles.google} onClick={continueWithGoogle} disabled={pending}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M23 12.27c0-.8-.07-1.57-.2-2.3H12v4.35h6.17a5.28 5.28 0 0 1-2.29 3.46v2.87h3.7C21.74 18.65 23 15.7 23 12.27z" />
          <path fill="#34A853" d="M12 23.5c3.1 0 5.7-1.03 7.58-2.8l-3.7-2.87c-1.03.69-2.34 1.1-3.88 1.1-2.98 0-5.5-2.01-6.4-4.72H1.78v2.96A11.5 11.5 0 0 0 12 23.5z" />
          <path fill="#FBBC05" d="M5.6 14.21a6.9 6.9 0 0 1 0-4.42V6.83H1.78a11.5 11.5 0 0 0 0 10.34l3.82-2.96z" />
          <path fill="#EA4335" d="M12 5.07c1.69 0 3.2.58 4.39 1.72l3.29-3.29C17.7 1.64 15.1.5 12 .5 7.5.5 3.63 3.08 1.78 6.83l3.82 2.96C6.5 7.08 9.02 5.07 12 5.07z" />
        </svg>
        {pending ? "Opening Google…" : mode === "signup" ? "Sign up with Google" : "Continue with Google"}
      </button>
      {mode === "signup" && <p className={styles.fine}>Free to start. No card needed.</p>}
    </div>
  );
}
