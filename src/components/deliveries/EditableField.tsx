"use client";

import { useId, useRef, useState, useTransition } from "react";
import type { ActionResult } from "@/lib/delivery-actions";
import styles from "./Editor.module.css";

type EditableFieldProps = {
  label: string;
  defaultValue: string;
  maxLength: number;
  save: (value: string) => Promise<ActionResult>;
  multiline?: boolean;
  placeholder?: string;
  // "title" and "heading" look like page text until focused; "plain" is a normal form control.
  look?: "title" | "heading" | "plain" | "quiet" | "compact";
  hideLabel?: boolean;
  // For names in a list: selects the text when focused, and Enter moves on to the next name instead of stopping.
  rename?: boolean;
};

type Status = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };

// Saves when the field loses focus, so there is no Save button to forget. The status sits under the field.
export function EditableField({
  label,
  defaultValue,
  maxLength,
  save,
  multiline,
  placeholder,
  look = "plain",
  hideLabel,
  rename,
}: EditableFieldProps) {
  const id = useId();
  const lastSaved = useRef(defaultValue);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [, startTransition] = useTransition();

  function commit(value: string) {
    if (value.trim() === lastSaved.current.trim()) return;
    setStatus({ kind: "saving" });
    startTransition(async () => {
      const result = await save(value);
      if (result.ok) {
        lastSaved.current = value;
        setStatus({ kind: "saved" });
      } else {
        setStatus({ kind: "error", message: result.error });
      }
    });
  }

  const shared = {
    id,
    name: id,
    defaultValue,
    maxLength,
    placeholder,
    className: `${styles.input} ${styles[look]}`,
    "aria-describedby": `${id}-status`,
    onInput: () => setStatus((current) => (current.kind === "idle" ? current : { kind: "idle" })),
    onBlur: (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => commit(event.currentTarget.value),
  };

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={hideLabel ? styles.srOnly : styles.label}>
        {label}
      </label>
      <div className={styles.control}>
        {multiline ? (
          <textarea {...shared} rows={2} />
        ) : (
          <input
            {...shared}
            type="text"
            data-rename={rename ? "" : undefined}
            onFocus={rename ? (event) => event.currentTarget.select() : undefined}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              const current = event.currentTarget;
              if (rename) {
                const names = Array.from(document.querySelectorAll<HTMLInputElement>("input[data-rename]"));
                const next = names[names.indexOf(current) + 1];
                if (next) {
                  // Moving focus saves this name, because leaving the field commits it.
                  next.focus();
                  return;
                }
              }
              current.blur();
            }}
          />
        )}
        {(status.kind === "saving" || status.kind === "saved") && (
          <span className={styles.chip} data-kind={status.kind} aria-hidden="true">
            {status.kind === "saving" ? "Saving…" : "Saved"}
          </span>
        )}
      </div>
      <p id={`${id}-status`} className={styles.status} data-kind={status.kind} aria-live="polite">
        {status.kind === "saving" && <span className={styles.srOnly}>Saving</span>}
        {status.kind === "saved" && <span className={styles.srOnly}>Saved</span>}
        {status.kind === "error" && status.message}
      </p>
    </div>
  );
}
