"use client";

import { useState } from "react";
import { formatSize } from "@/lib/storage-limits";
import { deleteVersion, restoreVersion, versionDownloadUrl } from "@/lib/version-actions";
import { ActionButton } from "./ActionButton";
import { LocalTime } from "./LocalTime";
import styles from "./Editor.module.css";

export type VersionItem = { id: string; sizeBytes: number; ext: string | null; replacedAt: string };

function VersionRow({ version }: { version: VersionItem }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const result = await versionDownloadUrl(version.id);
      if (result.ok) window.location.assign(result.url);
      else setError(result.error);
    } catch {
      setError("Could not get this version. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className={styles.version}>
      <span className={styles.versionInfo}>
        Replaced <LocalTime iso={version.replacedAt} dateOnly />
        {` · ${formatSize(version.sizeBytes)}${version.ext ? ` · ${version.ext.toUpperCase()}` : ""}`}
      </span>
      <span className={styles.versionActions}>
        <button type="button" className={`${styles.button} ${styles.ghost}`} onClick={download} disabled={busy}>
          {busy ? "Getting…" : "Download"}
        </button>
        <ActionButton action={restoreVersion.bind(null, version.id)} variant="ghost" label="Put this version back">
          Restore
        </ActionButton>
        <ActionButton
          action={deleteVersion.bind(null, version.id)}
          variant="ghost"
          confirmLabel="Delete version"
          label="Delete this version"
        >
          Delete
        </ActionButton>
      </span>
      {error && (
        <span role="alert" className={styles.actionError}>
          {error}
        </span>
      )}
    </li>
  );
}

// The copies kept when a file was replaced. Closed until the creative wants them.
export function FileVersions({ versions }: { versions: VersionItem[] }) {
  if (versions.length === 0) return null;
  return (
    <details className={styles.noteBox}>
      <summary>
        Earlier versions ({versions.length})
      </summary>
      <ul className={styles.versions}>
        {versions.map((version) => (
          <VersionRow key={version.id} version={version} />
        ))}
      </ul>
    </details>
  );
}
