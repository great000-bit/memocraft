"use client";

import { useEffect, useState } from "react";
import { SuccessModal } from "./SuccessModal";
import styles from "./Editor.module.css";
import modal from "./SuccessModal.module.css";

// Shown once, straight after "Create delivery": what was made, and the next step one tap away.
export function CreatedModal({ title, clientName }: { title: string; clientName: string | null }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("created") !== "1") return;
    url.searchParams.delete("created");
    window.history.replaceState(window.history.state, "", url);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- opens once, after a fresh create
    setOpen(true);
  }, []);

  function addFiles() {
    setOpen(false);
    // The step's heading carries the id; its section holds the file picker.
    const step = document.getElementById("step-files")?.closest("section");
    step?.scrollIntoView({ behavior: "smooth", block: "start" });
    step?.querySelector<HTMLInputElement>('input[type="file"]')?.click();
  }

  return (
    <SuccessModal
      open={open}
      onClose={() => setOpen(false)}
      title="Delivery created"
      actions={
        <>
          <button type="button" className={`${styles.button} ${styles.primary}`} onClick={addFiles}>
            Add the files
          </button>
          <button type="button" className={`${styles.button} ${styles.ghost}`} onClick={() => setOpen(false)}>
            Later
          </button>
        </>
      }
    >
      <p className={modal.text}>
        <b>{title}</b>
        {clientName ? ` for ${clientName}` : ""} is ready. Add the files next. Nothing is shared until you publish.
      </p>
    </SuccessModal>
  );
}
