"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/delivery-actions";
import styles from "./Editor.module.css";

type ActionButtonProps = {
  action: () => Promise<ActionResult>;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "add" | "danger";
  // Destructive buttons ask twice, inline, instead of using a browser dialog.
  confirmLabel?: string;
  label?: string;
};

export function ActionButton({ action, children, variant = "secondary", confirmLabel, label }: ActionButtonProps) {
  const [pending, startTransition] = useTransition();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    startTransition(async () => {
      const result = await action();
      setArmed(false);
      if (!result.ok) setError(result.error);
    });
  }

  if (confirmLabel && armed) {
    return (
      <span className={styles.confirm}>
        <button type="button" className={`${styles.button} ${styles.danger}`} onClick={run} disabled={pending}>
          {pending ? "Removing…" : confirmLabel}
        </button>
        <button type="button" className={`${styles.button} ${styles.secondary}`} onClick={() => setArmed(false)} disabled={pending}>
          Keep
        </button>
      </span>
    );
  }

  return (
    <span className={styles.actionWrap}>
      <button
        type="button"
        className={`${styles.button} ${styles[variant]}`}
        onClick={confirmLabel ? () => setArmed(true) : run}
        disabled={pending}
        aria-label={label}
      >
        {children}
      </button>
      {error && (
        <span role="alert" className={styles.actionError}>
          {error}
        </span>
      )}
    </span>
  );
}
