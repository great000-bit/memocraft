"use client";

import { useState } from "react";
import { setLinkExpiry, setLinkPassword } from "@/lib/delivery-actions";
import { passwordRules } from "@/lib/delivery-limits";
import { ActionButton } from "./ActionButton";
import { LocalTime } from "./LocalTime";
import { useSave } from "./useSave";
import styles from "./Editor.module.css";

type LinkSettingsProps = {
  deliveryId: string;
  // ISO time the link stops working, or null when it never does.
  expiresAt: string | null;
  expired: boolean;
  hasPassword: boolean;
};

function todayLocal(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function PasswordRow({ deliveryId, hasPassword }: { deliveryId: string; hasPassword: boolean }) {
  const [editing, setEditing] = useState(false);
  const { pending, error, save, clear } = useSave();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    save(() => setLinkPassword(deliveryId, password), () => setEditing(false));
  }

  return (
    <div className={styles.setting}>
      <div className={styles.settingText}>
        <h3 className={styles.settingTitle}>Password</h3>
        <p className={styles.settingNote}>
          {hasPassword
            ? "On. Your client types it before they see anything. Tell them the password in a separate message."
            : "Off. Anyone with the link can open it."}
        </p>
      </div>
      {editing ? (
        <form className={styles.settingForm} onSubmit={submit}>
          <label htmlFor={`pw-${deliveryId}`} className={styles.srOnly}>
            New password
          </label>
          <input
            id={`pw-${deliveryId}`}
            name="password"
            type="text"
            className={styles.settingInput}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            minLength={passwordRules.min}
            maxLength={passwordRules.max}
            placeholder={`At least ${passwordRules.min} characters`}
            required
            autoFocus
          />
          <button type="submit" className={`${styles.button} ${styles.primary}`} disabled={pending}>
            {pending ? "Saving…" : "Save password"}
          </button>
          <button
            type="button"
            className={`${styles.button} ${styles.secondary}`}
            disabled={pending}
            onClick={() => {
              clear();
              setEditing(false);
            }}
          >
            Cancel
          </button>
          {error && (
            <p role="alert" className={styles.settingError}>
              {error}
            </p>
          )}
          <p className={styles.settingNote}>We keep only a scrambled copy, so we cannot show it to you again.</p>
        </form>
      ) : (
        <div className={styles.settingActions}>
          <button type="button" className={`${styles.button} ${styles.secondary}`} onClick={() => setEditing(true)}>
            {hasPassword ? "Change" : "Add password"}
          </button>
          {hasPassword && (
            <ActionButton
              action={() => setLinkPassword(deliveryId, null)}
              variant="ghost"
              confirmLabel="Remove password"
              label="Remove the password"
            >
              Remove
            </ActionButton>
          )}
        </div>
      )}
    </div>
  );
}

function ExpiryRow({ deliveryId, expiresAt, expired }: { deliveryId: string; expiresAt: string | null; expired: boolean }) {
  // While the date field is open this holds the earliest day it accepts, which is today on the viewer's clock.
  const [earliest, setEarliest] = useState<string | null>(null);
  const { pending, error, save, clear } = useSave();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const day = String(new FormData(event.currentTarget).get("day") ?? "");
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
    if (!match) return;
    // The link works through the whole day the creative picked, in their own time zone.
    const endOfDay = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 23, 59, 0);
    save(() => setLinkExpiry(deliveryId, endOfDay.toISOString()), () => setEarliest(null));
  }

  return (
    <div className={styles.setting}>
      <div className={styles.settingText}>
        <h3 className={styles.settingTitle}>Expiry date</h3>
        <p className={styles.settingNote}>
          {expiresAt === null ? (
            "None. The link works until you pause it."
          ) : expired ? (
            <>
              Expired on <LocalTime iso={expiresAt} />. Your client sees that it has expired.
            </>
          ) : (
            <>
              Stops working after <LocalTime iso={expiresAt} />.
            </>
          )}
        </p>
      </div>
      {earliest !== null ? (
        <form className={styles.settingForm} onSubmit={submit}>
          <label htmlFor={`day-${deliveryId}`} className={styles.srOnly}>
            Last day the link works
          </label>
          <input id={`day-${deliveryId}`} name="day" type="date" className={styles.settingInput} min={earliest} required autoFocus />
          <button type="submit" className={`${styles.button} ${styles.primary}`} disabled={pending}>
            {pending ? "Saving…" : "Save date"}
          </button>
          <button
            type="button"
            className={`${styles.button} ${styles.secondary}`}
            disabled={pending}
            onClick={() => {
              clear();
              setEarliest(null);
            }}
          >
            Cancel
          </button>
          {error && (
            <p role="alert" className={styles.settingError}>
              {error}
            </p>
          )}
          <p className={styles.settingNote}>The link works through the end of that day.</p>
        </form>
      ) : (
        <div className={styles.settingActions}>
          <button type="button" className={`${styles.button} ${styles.secondary}`} onClick={() => setEarliest(todayLocal())}>
            {expiresAt === null ? "Set a date" : "Change"}
          </button>
          {expiresAt !== null && (
            <ActionButton action={() => setLinkExpiry(deliveryId, null)} variant="ghost" label="Remove the expiry date">
              Remove
            </ActionButton>
          )}
        </div>
      )}
    </div>
  );
}

// Who can open the link, and until when. Closed by default to keep the editor simple; the summary says what is on.
export function LinkSettings({ deliveryId, expiresAt, expired, hasPassword }: LinkSettingsProps) {
  return (
    <section className={styles.linkSettings} aria-label="Link settings">
      <details>
        <summary>
          <span className={styles.settingsLabel}>Link settings</span>
          <span className={styles.settingsChips}>
            {hasPassword && <span className={styles.settingsChip}>Password on</span>}
            {expiresAt !== null && (
              <span className={styles.settingsChip} data-tone={expired ? "expired" : undefined}>
                {expired ? "Expired" : "Expires"} <LocalTime iso={expiresAt} dateOnly />
              </span>
            )}
            {!hasPassword && expiresAt === null && <span className={styles.settingsNone}>Password, expiry date</span>}
          </span>
        </summary>
        <div className={styles.settingsBody}>
          <PasswordRow deliveryId={deliveryId} hasPassword={hasPassword} />
          <ExpiryRow deliveryId={deliveryId} expiresAt={expiresAt} expired={expired} />
        </div>
      </details>
    </section>
  );
}
