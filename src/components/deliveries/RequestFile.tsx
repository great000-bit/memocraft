"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { limits } from "@/lib/delivery-limits";
import { submitRequest } from "@/lib/request-actions";
import styles from "./ClientView.module.css";

const askEvent = "memocraft:ask";

// A quiet link under a file: one tap takes the client to the request form with that file already chosen.
export function AskAbout({ fileId }: { fileId: string }) {
  return (
    <button
      type="button"
      className={styles.askLink}
      onClick={() => {
        window.dispatchEvent(new CustomEvent(askEvent, { detail: fileId }));
        document.getElementById("ask")?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
          block: "center",
        });
      }}
    >
      Need another format?
    </button>
  );
}

// Where a client asks the sender for something: a different format, a file that is missing. It lands on the
// sender's list of requests. Nothing about the client is asked for or kept.
export function RequestFile({ slug, senderName, files }: { slug: string; senderName: string; files: { id: string; name: string }[] }) {
  const [file, setFile] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const message = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    function onAsk(event: Event) {
      setFile(String((event as CustomEvent<string>).detail ?? ""));
      setSent(false);
      setError(null);
      requestAnimationFrame(() => message.current?.focus({ preventScroll: true }));
    }
    window.addEventListener(askEvent, onAsk);
    return () => window.removeEventListener(askEvent, onAsk);
  }, []);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError(null);
    startTransition(async () => {
      try {
        const result = await submitRequest(slug, data);
        if (result.ok) {
          form.reset();
          setFile("");
          setSent(true);
        } else {
          setError(result.error);
        }
      } catch {
        setError("Could not send this. Check your connection and try again.");
      }
    });
  }

  return (
    <section id="ask" className={styles.ask} aria-labelledby="ask-title">
      <h2 id="ask-title" className={styles.askTitle}>
        Need something else?
      </h2>
      {sent ? (
        <div className={styles.askDone} role="status">
          <p>Sent. {senderName} will see your request.</p>
          <button type="button" className={styles.askLink} onClick={() => setSent(false)}>
            Ask for something else
          </button>
        </div>
      ) : (
        <form className={styles.askForm} onSubmit={submit}>
          <p className={styles.askText}>Ask {senderName} for another format or a file that is missing.</p>
          {files.length > 0 && (
            <div className={styles.askField}>
              <label htmlFor="ask-file">About</label>
              <select id="ask-file" name="file" value={file} onChange={(event) => setFile(event.target.value)}>
                <option value="">Something new</option>
                {files.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className={styles.askField}>
            <label htmlFor="ask-message">What do you need?</label>
            <textarea
              id="ask-message"
              name="message"
              ref={message}
              rows={3}
              maxLength={limits.request}
              placeholder="For example: the logo as a PNG with a transparent background."
              required
            />
          </div>
          {error && (
            <p className={styles.askError} role="alert">
              {error}
            </p>
          )}
          <button type="submit" className={styles.askSubmit} disabled={pending}>
            {pending ? "Sending…" : "Send request"}
          </button>
        </form>
      )}
    </section>
  );
}
