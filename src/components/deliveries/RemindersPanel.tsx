"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { markRemindersHandled, setReminderDays } from "@/lib/reminder-actions";
import { FeatureIcon } from "../FeatureIcons";
import { LocalTime } from "./LocalTime";
import activity from "./Activity.module.css";
import styles from "./OwnerFeedback.module.css";

const choices = [2, 3, 5, 7];

// Follow-ups for a client who has not opened the link. Memocraft emails them when it can; otherwise it tells the
// creative when to nudge and hands them the words, ready for WhatsApp, a text or an email.
export function RemindersPanel({
  deliveryId,
  days,
  clientName,
  clientEmail,
  emailOn,
  opened,
  nextAt,
  sent,
  message,
}: {
  deliveryId: string;
  days: number | null;
  clientName: string | null;
  clientEmail: string | null;
  emailOn: boolean;
  opened: boolean;
  nextAt: string | null;
  sent: { n: number; channel: "email" | "app"; at: string; handled: boolean }[];
  message: string;
}) {
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const who = clientName?.trim() || "your client";
  const waiting = sent.some((reminder) => reminder.channel === "app" && !reminder.handled);
  const willEmail = emailOn && Boolean(clientEmail);

  function run(task: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await task();
        if (result.ok) router.refresh();
        else setError(result.error ?? "Could not save that.");
      } catch {
        setError("Could not save that. Try again.");
      }
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy. Select the message and copy it yourself.");
    }
  }

  const mail = clientEmail
    ? `mailto:${encodeURIComponent(clientEmail)}?subject=${encodeURIComponent("Your files are ready")}&body=${encodeURIComponent(message)}`
    : null;

  return (
    <section id="reminders" className={`${activity.panel} ${styles.panel}`} aria-labelledby="reminders-title">
      <div className={activity.head}>
        <h2 id="reminders-title" className={activity.title}>
          Reminders
        </h2>
        <span className={activity.badge} data-state={opened ? "opened" : "waiting"}>
          {opened ? "Opened, none needed" : days === null ? "Off" : `After ${days} days`}
        </span>
      </div>

      {waiting && (
        <div className={styles.due} role="status">
          <p className={styles.dueTitle}>{who[0].toUpperCase() + who.slice(1)} has not opened the link yet. Send a reminder?</p>
          <pre className={styles.message}>{message}</pre>
          <div className={styles.actions}>
            <a className={styles.whatsApp} href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener">
              Send on WhatsApp
            </a>
            <button type="button" className={styles.primaryAction} onClick={copy}>
              {copied ? "Copied" : "Copy message"}
            </button>
            {mail && (
              <a className={styles.quietAction} href={mail}>
                Email it
              </a>
            )}
            <button type="button" className={styles.quietAction} disabled={pending} onClick={() => run(() => markRemindersHandled(deliveryId))}>
              Done
            </button>
          </div>
        </div>
      )}

      {!waiting && (
        <p className={styles.status}>
          <FeatureIcon name="nudge" />
          <span>
            {opened ? (
              `${who[0].toUpperCase() + who.slice(1)} opened the link, so no reminders are needed.`
            ) : days === null ? (
              "Reminders are off for this delivery."
            ) : nextAt ? (
              <>
                If {who} has not opened it by <LocalTime iso={nextAt} dateOnly />,{" "}
                {willEmail ? `we email ${clientEmail} for you.` : "we remind you here and on your phone, with a message ready to send."}
              </>
            ) : sent.length > 0 ? (
              "Both reminders have gone out. No more will be sent."
            ) : (
              "Reminders start once the link is sent."
            )}
          </span>
        </p>
      )}

      <div className={styles.fields}>
        <label className={styles.field}>
          <span>Remind if not opened after</span>
          <select
            value={days === null ? "off" : String(days)}
            disabled={pending}
            onChange={(event) => {
              const value = event.target.value === "off" ? null : Number(event.target.value);
              run(() => setReminderDays(deliveryId, value));
            }}
          >
            {choices.map((choice) => (
              <option key={choice} value={choice}>
                {choice} days
              </option>
            ))}
            <option value="off">Never, reminders off</option>
          </select>
        </label>
      </div>

      {sent.length > 0 && (
        <ul className={styles.receipts}>
          {sent.map((reminder) => (
            <li key={reminder.n} className={styles.receipt} data-current>
              <span className={styles.receiptText}>
                <b>
                  {reminder.n === 1 ? "First" : "Second"} reminder{" "}
                  {reminder.channel === "email" ? `emailed to ${who}` : reminder.handled ? "sent by you" : "waiting for you"}
                </b>
                <LocalTime iso={reminder.at} />
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className={styles.hint}>
        {emailOn
          ? clientEmail
            ? `Reminders go to ${clientEmail}. At most two, and none once the link is opened.`
            : "Add your client's email in step 1 and we email the reminders for you. At most two, and none once the link is opened."
          : "Memocraft does not send email yet, so reminders come to you with a message ready to send. At most two, and none once the link is opened."}
      </p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
