"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import styles from "./Workspace.module.css";

// A quiet strip for someone whose email address is not confirmed yet. It never blocks anything.
export function VerifyEmail({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function resend() {
    setState("sending");
    try {
      const result = await authClient.sendVerificationEmail({ email, callbackURL: "/dashboard" });
      setState(result.error ? "error" : "sent");
    } catch {
      setState("error");
    }
  }

  return (
    <div className={styles.verify} role="status">
      <span>
        {state === "sent"
          ? "Sent. Open the link in the email to confirm."
          : state === "error"
            ? "We could not send that. Try again in a minute."
            : `Confirm your email. We sent a link to ${email}.`}
      </span>
      {state !== "sent" && (
        <button type="button" className={styles.verifyButton} onClick={resend} disabled={state === "sending"}>
          {state === "sending" ? "Sending…" : "Send it again"}
        </button>
      )}
    </div>
  );
}
