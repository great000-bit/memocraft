"use client";

import { useState, useSyncExternalStore } from "react";
import { setPublished } from "@/lib/delivery-actions";
import { ActionButton } from "./ActionButton";
import styles from "./Editor.module.css";

const noopSubscribe = () => () => {};

type PublishPanelProps = { deliveryId: string; slug: string; published: boolean };

// The link is built from the address the page was opened on, so it is right on every host.
export function PublishPanel({ deliveryId, slug, published }: PublishPanelProps) {
  const origin = useSyncExternalStore(noopSubscribe, () => window.location.origin, () => "");
  const [copied, setCopied] = useState(false);
  const url = `${origin}/d/${slug}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the link stays selectable in the field.
    }
  }

  if (!published) {
    return (
      <section className={styles.share} aria-labelledby="share-title">
        <div>
          <h2 id="share-title" className={styles.shareTitle}>
            Not shared yet
          </h2>
          <p className={styles.shareText}>Publish to switch the link on. Your client opens it with no account.</p>
        </div>
        <ActionButton key="publish" action={() => setPublished(deliveryId, true)} variant="primary">
          Publish
        </ActionButton>
      </section>
    );
  }

  return (
    <section className={styles.share} aria-labelledby="share-title">
      <div className={styles.shareMain}>
        <h2 id="share-title" className={styles.shareTitle}>
          Shared with anyone who has the link
        </h2>
        <div className={styles.linkRow}>
          <input
            className={styles.linkInput}
            readOnly
            value={url}
            aria-label="Client link"
            onFocus={(event) => event.currentTarget.select()}
          />
          <button type="button" className={`${styles.button} ${styles.primary}`} onClick={copy}>
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
        <p className={styles.shareText}>Unpublishing switches the link off straight away. Publishing again turns the same link back on.</p>
      </div>
      <ActionButton key="unpublish" action={() => setPublished(deliveryId, false)} variant="secondary">
        Unpublish
      </ActionButton>
    </section>
  );
}
