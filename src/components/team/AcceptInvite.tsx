"use client";

import { useState, useTransition } from "react";
import { acceptInvite } from "@/lib/team-actions";
import styles from "@/components/auth/AuthForm.module.css";
import editor from "@/components/deliveries/Editor.module.css";

// Joining is a button press, never a page visit, so a link preview or a scanner cannot accept an invite.
export function AcceptInvite({ token, teamName }: { token: string; teamName: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className={styles.social}>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        className={editor.button}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await acceptInvite(token);
            if (result && !result.ok) setError(result.error);
          })
        }
      >
        {pending ? "Joining…" : `Join ${teamName}`}
      </button>
    </div>
  );
}
