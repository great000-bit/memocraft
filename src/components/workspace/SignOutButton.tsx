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
    <button type="button" className={styles.signOut} onClick={signOut} disabled={pending}>
      {pending ? "Logging out…" : "Log out"}
    </button>
  );
}
