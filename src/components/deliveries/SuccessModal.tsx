"use client";

import { useEffect, useRef } from "react";
import styles from "./SuccessModal.module.css";

type SuccessModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: React.ReactNode;
  actions: React.ReactNode;
};

// A moment of "done": a tick pops in over a soft burst, with the next thing to do right there. It is a real <dialog>,
// so focus stays inside, Escape closes it and the page behind cannot be clicked.
export function SuccessModal({ open, onClose, title, children, actions }: SuccessModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) {
      node.showModal();
      // The browser focuses the first button, which paints a focus ring on Copy before anyone has touched it.
      // Start on the card instead; Tab still goes straight to the buttons.
      card.current?.focus({ preventScroll: true });
    }
    if (!open && node.open) node.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="success-title"
      onClose={onClose}
      onClick={(event) => {
        // A click on the dimmed backdrop lands on the dialog itself.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div ref={card} className={styles.card} tabIndex={-1}>
        <span className={styles.burst} aria-hidden="true">
          {Array.from({ length: 10 }, (_, i) => (
            <i key={i} style={{ "--i": i } as React.CSSProperties} />
          ))}
        </span>
        <span className={styles.tick} aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M5 12.5l4.2 4.2L19 7" />
          </svg>
        </span>
        <h2 id="success-title" className={styles.title}>
          {title}
        </h2>
        {children}
        <div className={styles.actions}>{actions}</div>
      </div>
    </dialog>
  );
}
