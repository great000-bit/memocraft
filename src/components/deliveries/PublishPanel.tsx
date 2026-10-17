"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { setPublished } from "@/lib/delivery-actions";
import type { LinkState } from "@/lib/deliveries";
import { ActionButton } from "./ActionButton";
import { SuccessModal } from "./SuccessModal";
import styles from "./Editor.module.css";
import modal from "./SuccessModal.module.css";

// Publishing re-renders the editor and this panel mounts again in its live form, so the "just published" moment is
// handed across in sessionStorage and the live panel opens the success pop-up when it finds it.
const justPublished = "mc-just-published";

function mark(deliveryId: string) {
  try {
    sessionStorage.setItem(justPublished, deliveryId);
  } catch {}
}

function take(deliveryId: string) {
  try {
    if (sessionStorage.getItem(justPublished) !== deliveryId) return false;
    sessionStorage.removeItem(justPublished);
    return true;
  } catch {
    return false;
  }
}

const noopSubscribe = () => () => {};

// "linkOrigin" is the creative's own web address when one is connected; otherwise the link uses this site's address.
type PublishPanelProps = { deliveryId: string; slug: string; state: LinkState; clientName?: string | null; linkOrigin?: string | null };

// The link is built from the address the page was opened on, so it is right on every host.
export function PublishPanel({ deliveryId, slug, state, clientName, linkOrigin }: PublishPanelProps) {
  const origin = useSyncExternalStore(noopSubscribe, () => window.location.origin, () => "");
  const [copied, setCopied] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const url = `${linkOrigin || origin}/d/${slug}`;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- opens once, right after the publish re-render
    if (state === "live" && take(deliveryId)) setCelebrate(true);
  }, [state, deliveryId]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the link stays selectable in the field.
    }
  }

  if (state === "draft") {
    return (
      <section className={styles.share} aria-labelledby="share-title">
        <div>
          <h2 id="share-title" className={styles.shareTitle}>
            Ready to send?
          </h2>
          <p className={styles.shareText}>Publish to switch on your client link. They open it on any phone, with no account.</p>
        </div>
        <ActionButton
          key="publish"
          action={async () => {
            mark(deliveryId);
            const result = await setPublished(deliveryId, true);
            if (!result.ok) take(deliveryId);
            return result;
          }}
          variant="primary"
        >
          Publish
        </ActionButton>
      </section>
    );
  }

  // Pausing is the switch that was always there: the link stops working at once and the same link comes back on resume.
  if (state === "paused") {
    return (
      <section className={styles.share} aria-labelledby="share-title">
        <div>
          <h2 id="share-title" className={styles.shareTitle}>
            Link paused
          </h2>
          <p className={styles.shareText}>Your client sees that the link is not available. Resume to switch the same link back on.</p>
        </div>
        <ActionButton key="resume" action={() => setPublished(deliveryId, true)} variant="primary">
          Resume link
        </ActionButton>
      </section>
    );
  }

  return (
    <section className={styles.share} aria-labelledby="share-title">
      <div className={styles.shareMain}>
        <div className={styles.shareHead}>
          {state !== "expired" && (
            <span className={styles.shareTick} aria-hidden="true">
              ✓
            </span>
          )}
          <h2 id="share-title" className={styles.shareTitle}>
            {state === "expired" ? "This link has expired" : "Your link is live"}
          </h2>
        </div>
        <div className={styles.linkRow}>
          <input
            className={styles.linkInput}
            readOnly
            value={url}
            aria-label="Client link"
            onFocus={(event) => event.currentTarget.select()}
          />
          <button type="button" className={`${styles.button} ${styles.primary} ${copied ? styles.copied : ""}`} onClick={copy}>
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
        <p className={styles.shareText}>
          {state === "expired"
            ? "Your client sees that it has expired. Pick a new date under Link settings, or remove the date, to switch it back on."
            : "Anyone with the link can open it, no account needed. Pausing switches it off straight away."}
        </p>
      </div>
      <ActionButton key="pause" action={() => setPublished(deliveryId, false)} variant="secondary">
        Pause link
      </ActionButton>
      <SuccessModal
        open={celebrate}
        onClose={() => setCelebrate(false)}
        title="Your link is live"
        actions={
          <>
            <button type="button" className={`${styles.button} ${styles.primary} ${copied ? styles.copied : ""}`} onClick={copy}>
              {copied ? "Copied" : "Copy link"}
            </button>
            <a href={url} target="_blank" rel="noopener" className={`${styles.button} ${styles.secondary}`}>
              Open it as your client
            </a>
            <button type="button" className={`${styles.button} ${styles.ghost}`} onClick={() => setCelebrate(false)}>
              Done
            </button>
          </>
        }
      >
        <p className={modal.text}>
          Send it to {clientName?.trim() || "your client"} any way you like. They open it on any phone, no account needed.
        </p>
        <div className={modal.link}>
          <span className={modal.url}>{url.replace(/^https?:\/\//, "")}</span>
        </div>
      </SuccessModal>
    </section>
  );
}
