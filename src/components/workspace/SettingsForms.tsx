"use client";

import { useActionState, useState } from "react";
import { deleteAccount, type AccountResult } from "@/lib/account-actions";
import { authClient } from "@/lib/auth-client";
import editor from "@/components/deliveries/Editor.module.css";
import styles from "./Settings.module.css";

const passwordRules = { min: 8, max: 128 } as const;

export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [others, setOthers] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDone(false);
    if (next.length < passwordRules.min) return setError(`Use at least ${passwordRules.min} characters for the new password.`);
    if (next.length > passwordRules.max) return setError(`Keep the new password under ${passwordRules.max} characters.`);
    if (next !== again) return setError("The two new passwords are not the same.");
    if (next === current) return setError("Pick a password you have not used just now.");
    setError(null);
    setPending(true);
    try {
      const { error: failure } = await authClient.changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: others,
      });
      if (failure) {
        setError(failure.code === "INVALID_PASSWORD" ? "Your current password is not right." : "We could not change your password. Try again.");
        return;
      }
      setCurrent("");
      setNext("");
      setAgain("");
      setDone(true);
    } catch {
      setError("We could not reach Memocraft. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className={styles.form}>
      <div className={styles.field}>
        <label htmlFor="current-password" className={styles.label}>
          Current password
        </label>
        <input
          id="current-password"
          type="password"
          className={styles.input}
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          autoComplete="current-password"
          required
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="new-password" className={styles.label}>
          New password
        </label>
        <input
          id="new-password"
          type="password"
          className={styles.input}
          value={next}
          onChange={(event) => setNext(event.target.value)}
          autoComplete="new-password"
          minLength={passwordRules.min}
          maxLength={passwordRules.max}
          required
        />
        <p className={styles.hint}>At least {passwordRules.min} characters.</p>
      </div>
      <div className={styles.field}>
        <label htmlFor="repeat-password" className={styles.label}>
          New password again
        </label>
        <input
          id="repeat-password"
          type="password"
          className={styles.input}
          value={again}
          onChange={(event) => setAgain(event.target.value)}
          autoComplete="new-password"
          required
        />
      </div>
      <label className={styles.checkRow}>
        <input type="checkbox" checked={others} onChange={(event) => setOthers(event.target.checked)} />
        <span>Log me out on my other devices</span>
      </label>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <div className={styles.buttonRow}>
        <button type="submit" className={`${editor.button} ${editor.primary}`} disabled={pending}>
          {pending ? "Changing…" : "Change password"}
        </button>
        {done && (
          <span role="status" className={styles.ok}>
            Password changed
          </span>
        )}
      </div>
    </form>
  );
}

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
