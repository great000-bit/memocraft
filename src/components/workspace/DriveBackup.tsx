"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { backUpNow, getDriveStatus, turnOffDriveBackup, turnOnDriveBackup } from "@/lib/drive-actions";
import { driveRequest } from "@/lib/drive-scope";
import type { DriveStatus } from "@/lib/drive";
import editor from "@/components/deliveries/Editor.module.css";
import styles from "./Settings.module.css";

const notices: Record<string, { ok: boolean; text: string }> = {
  on: { ok: true, text: "Drive backup is on. Your files are being copied to a Memocraft folder in your Drive, and new uploads follow automatically." },
  declined: { ok: false, text: "Google did not give Memocraft access to Drive, so nothing was turned on." },
};

// Settings card for "Back up to my Google Drive". Granting the permission goes through Google; everything after
// that happens on our side, and the counts below refresh while files are still being copied.
export function DriveBackup({ initial }: { initial: DriveStatus }) {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState(initial);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(notices[params.get("drive") ?? ""] ?? null);
  const started = useRef(false);

  const refresh = useCallback(async () => {
    try {
      setStatus(await getDriveStatus());
    } catch {
      // The next tick tries again.
    }
  }, []);

  const connect = useCallback(async () => {
    setPending(true);
    setMessage(null);
    try {
      const result = await authClient.linkSocial({
        provider: "google",
        ...driveRequest,
        callbackURL: "/api/drive/connected?from=link&to=/settings",
        errorCallbackURL: "/settings?drive=declined",
      });
      if (result.error) {
        setMessage({ ok: false, text: "We could not reach Google. Try again in a moment." });
        setPending(false);
      }
    } catch {
      setMessage({ ok: false, text: "We could not reach Memocraft. Try again." });
      setPending(false);
    }
  }, []);

  // An account made before automatic backup signed in: Google needs one more step, sent here once.
  useEffect(() => {
    if (params.get("drive") === "connect" && !started.current && !status.connected) {
      started.current = true;
      void connect();
    }
  }, [params, status.connected, connect]);

  const copying = status.enabled && status.pending > 0 && !status.lastError;
  useEffect(() => {
    if (!copying) return;
    const timer = setInterval(refresh, 6000);
    return () => clearInterval(timer);
  }, [copying, refresh]);

  async function run(action: () => Promise<void>) {
    setPending(true);
    setMessage(null);
    try {
      await action();
      await refresh();
      router.refresh();
    } catch {
      setMessage({ ok: false, text: "We could not do that. Try again." });
    } finally {
      setPending(false);
    }
  }

  const active = status.connected && status.enabled;
  return (
    <div className={styles.driveBlock}>
      {active ? (
        <>
          <p className={styles.panelText}>
            Automatic backup is on. {status.done} {status.done === 1 ? "file is" : "files are"} saved in your Drive
            {status.pending > 0 ? `, ${status.pending} still to copy` : ""}
            {status.failed > 0 ? `, ${status.failed} could not be copied` : ""}.
          </p>
          {status.lastError && (
            <p role="alert" className={editor.actionError}>
              {status.lastError}
            </p>
          )}
          <div className={styles.buttonRow}>
            {status.lastError?.includes("connect Drive again") ? (
              <button type="button" className={`${editor.button} ${editor.primary}`} onClick={connect} disabled={pending}>
                Connect Drive again
              </button>
            ) : (
              <button type="button" className={`${editor.button} ${editor.secondary}`} onClick={() => run(backUpNow)} disabled={pending}>
                Back up now
              </button>
            )}
            <button type="button" className={`${editor.button} ${editor.secondary}`} onClick={() => run(turnOffDriveBackup)} disabled={pending}>
              Turn off
            </button>
          </div>
        </>
      ) : (
        <div className={styles.buttonRow}>
          <button
            type="button"
            className={`${editor.button} ${editor.primary}`}
            onClick={status.connected ? () => run(turnOnDriveBackup) : connect}
            disabled={pending}
          >
            {pending ? "Working…" : status.connected ? "Turn automatic backup back on" : "Allow Drive backup"}
          </button>
        </div>
      )}
      {message && (
        <span role={message.ok ? "status" : "alert"} className={message.ok ? styles.ok : editor.actionError}>
          {message.text}
        </span>
      )}
    </div>
  );
}
