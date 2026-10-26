"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { switchWorkspace } from "@/lib/team-actions";
import styles from "./Team.module.css";

type Choice = { ownerId: string; label: string };

// A native select on purpose: it opens the same way on every phone and desktop, keyboard included.
export function WorkspaceSelect({ choices, current }: { choices: Choice[]; current: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <label className={styles.switcher} data-pending={pending || undefined}>
      <span className={styles.switcherLabel}>Workspace</span>
      <select
        className={styles.switcherSelect}
        value={current}
        disabled={pending}
        onChange={(event) => {
          const ownerId = event.target.value;
          startTransition(async () => {
            await switchWorkspace(ownerId);
            router.push("/dashboard");
            router.refresh();
          });
        }}
      >
        {choices.map((choice) => (
          <option key={choice.ownerId} value={choice.ownerId}>
            {choice.label}
          </option>
        ))}
      </select>
    </label>
  );
}
