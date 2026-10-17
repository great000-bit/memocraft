"use client";

import { useRef } from "react";
import { deleteUpdate, postUpdate } from "@/lib/delivery-actions";
import { limits } from "@/lib/delivery-limits";
import { ActionButton } from "./ActionButton";
import { LocalTime } from "./LocalTime";
import { useSave } from "./useSave";
import styles from "./Editor.module.css";

export type UpdateItem = { id: string; note: string; at: string };

// Where a creative says what changed after sending. The link stays the same; the client sees the note above the
// files, and any file that was added or replaced since the link went out is marked New or Updated.
export function UpdatesPanel({ deliveryId, updates }: { deliveryId: string; updates: UpdateItem[] }) {
  const form = useRef<HTMLFormElement>(null);
  const { pending, error, save } = useSave();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const note = String(new FormData(event.currentTarget).get("note") ?? "");
    save(
      () => postUpdate(deliveryId, note),
      () => form.current?.reset(),
    );
  }

  return (
    <section className={styles.updatesCard} aria-labelledby="updates-title">
      <div className={styles.shareMain}>
        <h2 id="updates-title" className={styles.shareTitle}>
          Changed something?
        </h2>
        <p className={styles.shareText}>
          Replace or add files any time, and the same link shows the new ones. Say what changed and your client sees it
          above the files.
        </p>
      </div>
      <form ref={form} className={styles.updateForm} onSubmit={submit}>
        <label htmlFor={`update-${deliveryId}`} className={styles.srOnly}>
          What changed
        </label>
        <input
          id={`update-${deliveryId}`}
          name="note"
          className={styles.settingInput}
          maxLength={limits.update}
          placeholder="For example: Retouched files replaced."
          autoComplete="off"
          required
        />
        <button type="submit" className={`${styles.button} ${styles.primary}`} disabled={pending}>
          {pending ? "Posting…" : "Post update"}
        </button>
        {error && (
          <p role="alert" className={styles.settingError}>
            {error}
          </p>
        )}
      </form>
      {updates.length > 0 && (
        <ul className={styles.updateList}>
          {updates.map((update) => (
            <li key={update.id} className={styles.updateRow}>
              <span className={styles.updateText}>
                <span className={styles.updateWhen}>
                  <LocalTime iso={update.at} />
                </span>
                {update.note}
              </span>
              <ActionButton action={deleteUpdate.bind(null, update.id)} variant="ghost" label="Remove this update">
                Remove
              </ActionButton>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
