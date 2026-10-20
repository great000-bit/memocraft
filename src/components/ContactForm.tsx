"use client";

import { useRef, useState } from "react";
import buttons from "./Button.module.css";
import styles from "./ContactForm.module.css";

type State = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; message: string };

// The contact form. It posts to /api/contact, which emails the message to the team; no address is ever on the page.
// The "website" field is hidden from people and left empty by them, so a filled one marks a bot.
export function ContactForm() {
  const [state, setState] = useState<State>({ kind: "idle" });
  const startedAt = useRef(0);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setState({ kind: "sending" });
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          message: data.get("message"),
          website: data.get("website"),
          startedAt: startedAt.current,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) return setState({ kind: "error", message: result.error ?? "Your message did not go through. Try again." });
      setState({ kind: "sent" });
    } catch {
      setState({ kind: "error", message: "You seem to be offline. Try again when you are connected." });
    }
  }

  if (state.kind === "sent") {
    return (
      <div className={styles.card} role="status">
        <p className={styles.sentTick} aria-hidden="true">
          ✓
        </p>
        <p className={styles.sentTitle}>Thanks, your message is on its way</p>
        <p className={styles.sentBody}>We read every message and reply to the email you gave, usually within a day or two.</p>
        <button type="button" className={styles.again} onClick={() => setState({ kind: "idle" })}>
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form
      className={styles.card}
      onSubmit={submit}
      onFocus={() => {
        if (!startedAt.current) startedAt.current = Date.now();
      }}
    >
      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor="contact-name">Your name</label>
          <input id="contact-name" name="name" autoComplete="name" required maxLength={100} />
        </div>
        <div className={styles.field}>
          <label htmlFor="contact-email">Email</label>
          <input id="contact-email" name="email" type="email" autoComplete="email" required maxLength={254} />
        </div>
      </div>
      <div className={styles.field}>
        <label htmlFor="contact-message">Message</label>
        <textarea id="contact-message" name="message" rows={5} required minLength={10} maxLength={5000} placeholder="A question, an idea, or something that did not work" />
      </div>
      <div className={styles.trap} aria-hidden="true">
        <label htmlFor="contact-website">Leave this empty</label>
        <input id="contact-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {state.kind === "error" && (
        <p className={styles.error} role="alert">
          {state.message}
        </p>
      )}
      <div className={styles.actions}>
        <button type="submit" className={`${buttons.button} ${buttons.primary} ${styles.submit}`} disabled={state.kind === "sending"}>
          {state.kind === "sending" ? "Sending…" : "Send message"}
        </button>
        <p className={styles.note}>We reply by email. Your address is only used to answer you.</p>
      </div>
    </form>
  );
}
