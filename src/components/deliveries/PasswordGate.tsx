"use client";

import { useActionState, useState } from "react";
import { FeatureIcon } from "../FeatureIcons";
import { unlockDelivery, type UnlockResult } from "@/lib/link-actions";
import { passwordRules } from "@/lib/delivery-limits";
import styles from "./LinkGate.module.css";

// The page a client sees first when the sender put a password on the link. Nothing about the delivery is shown
// until the password is right; the sender's name is, so the client knows whose files these are.
export function PasswordGate({ slug, senderName }: { slug: string; senderName: string }) {
  const [state, formAction, pending] = useActionState<UnlockResult, FormData>(unlockDelivery.bind(null, slug), null);
  const [shown, setShown] = useState(false);

  return (
    <main className={styles.page}>
      <span className={styles.badge} aria-hidden="true">
        <FeatureIcon name="lock" />
      </span>
      <div className={styles.top}>
        <h1 className={styles.title}>Enter the password</h1>
        <p className={styles.text}>{senderName} protected this delivery. Type the password they sent you to open it.</p>
      </div>
      <form className={styles.form} action={formAction}>
        <div className={styles.field}>
          <label htmlFor="link-password">Password</label>
          <div className={styles.wrap}>
            <input
              id="link-password"
              name="password"
              type={shown ? "text" : "password"}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={passwordRules.max * 2}
              required
              autoFocus
            />
            <button type="button" className={styles.reveal} onClick={() => setShown((value) => !value)} aria-pressed={shown}>
              {shown ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        {state && (
          <p className={styles.error} role="alert">
            {state.error}
          </p>
        )}
        <button type="submit" className={styles.submit} disabled={pending}>
          {pending ? "Checking…" : "Open delivery"}
        </button>
        <p className={styles.fine}>Do not have it? Ask {senderName}.</p>
      </form>
    </main>
  );
}
