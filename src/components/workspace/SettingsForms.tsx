"use client";

import { useActionState, useState } from "react";
import { deleteAccount, type AccountResult } from "@/lib/account-actions";
import { authClient } from "@/lib/auth-client";
import editor from "@/components/deliveries/Editor.module.css";
import styles from "./Settings.module.css";

export function OtherDevices() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function run() {
    setPending(true);
    setMessage(null);
    try {
      const { error } = await authClient.revokeOtherSessions();
      setMessage(error ? { ok: false, text: "We could not do that. Try again." } : { ok: true, text: "Done. Your other devices are logged out." });
    } catch {
      setMessage({ ok: false, text: "We could not reach Memocraft. Try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.buttonRow}>
      <button type="button" className={`${editor.button} ${editor.secondary}`} onClick={run} disabled={pending}>
        {pending ? "Logging out…" : "Log out other devices"}
      </button>
      {message && (
        <span role={message.ok ? "status" : "alert"} className={message.ok ? styles.ok : editor.actionError}>
          {message.text}
        </span>
      )}
    </div>
  );
}

// Deleting is irreversible, so it takes three deliberate steps: open the panel, type the email address, press the
// red button. A password account also types its password. The server checks every one of them again.
export function DeleteAccount({ email, hasPassword }: { email: string; hasPassword: boolean }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [state, action, pending] = useActionState<AccountResult | null, FormData>(deleteAccount, null);
  const matches = typed.trim().toLowerCase() === email.trim().toLowerCase();

  if (!open) {
    return (
      <div className={styles.buttonRow}>
        <button type="button" className={`${editor.button} ${editor.secondary}`} onClick={() => setOpen(true)}>
          Delete my account…
        </button>
      </div>
    );
  }

  return (
    <form action={action} className={styles.form}>
      <div className={styles.field}>
        <label htmlFor="confirm-email" className={styles.label}>
          Type <strong>{email}</strong> to confirm
        </label>
        <input
          id="confirm-email"
          name="confirm"
          className={styles.input}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          required
        />
      </div>
      {hasPassword && (
        <div className={styles.field}>
          <label htmlFor="confirm-password" className={styles.label}>
            Your password
          </label>
          <input
            id="confirm-password"
            name="password"
            type="password"
            className={styles.input}
            autoComplete="current-password"
            required
          />
        </div>
      )}
      {state && !state.ok && (
        <p role="alert" className={styles.error}>
          {state.error}
        </p>
      )}
      <div className={styles.buttonRow}>
        <button type="submit" className={`${editor.button} ${styles.dangerButton}`} disabled={!matches || pending}>
          {pending ? "Deleting…" : "Delete everything for good"}
        </button>
        <button type="button" className={`${editor.button} ${editor.secondary}`} onClick={() => setOpen(false)} disabled={pending}>
          Keep my account
        </button>
      </div>
    </form>
  );
}
