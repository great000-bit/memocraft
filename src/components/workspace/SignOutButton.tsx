"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import styles from "./Workspace.module.css";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await authClient.signOut();
    } finally {
      router.replace("/");
      router.refresh();
    }
  }

  return (
    <button type="button" className={styles.signOut} onClick={signOut} disabled={pending} data-label="Log out">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 4.5h3.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H14" />
        <path d="M10 8.5 6.5 12l3.5 3.5" />
        <path d="M6.5 12H15" />
      </svg>
      <span className={styles.signOutLabel}>{pending ? "Logging out…" : "Log out"}</span>
    </button>
  );
}
