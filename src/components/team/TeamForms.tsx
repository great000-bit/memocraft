"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { cancelInvite, changeRole, inviteTeammate, leaveTeam, removeMember, switchWorkspace, type InviteResult, type TeamResult } from "@/lib/team-actions";
import editor from "@/components/deliveries/Editor.module.css";
import panels from "@/components/workspace/Settings.module.css";
import styles from "./Team.module.css";

function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={styles.link}>
      <input className={panels.input} value={link} readOnly aria-label="Invite link" onFocus={(event) => event.target.select()} />
      <button
        type="button"
        className={`${editor.button} ${editor.secondary}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}

export function InviteForm({ disabled }: { disabled: boolean }) {
  const [state, action, pending] = useActionState<InviteResult | null, FormData>(inviteTeammate, null);
  return (
    <form action={action} className={panels.form}>
      <div className={styles.inviteRow}>
        <div className={panels.field}>
          <label htmlFor="invite-email" className={panels.label}>
            Their email
          </label>
          <input
            id="invite-email"
            name="email"
            type="email"
            className={panels.input}
            placeholder="name@studio.com"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            required
            disabled={disabled}
          />
        </div>
        <div className={panels.field}>
          <label htmlFor="invite-role" className={panels.label}>
            They can
          </label>
          <select id="invite-role" name="role" className={styles.select} defaultValue="editor" disabled={disabled}>
            <option value="editor">Edit</option>
            <option value="viewer">View only</option>
          </select>
        </div>
        <button type="submit" className={editor.button} disabled={pending || disabled}>
          {pending ? "Inviting…" : "Invite"}
        </button>
      </div>
      {state && !state.ok && (
        <p role="alert" className={panels.error}>
          {state.error}
        </p>
      )}
      {state?.ok && (
        <div className={panels.field} role="status">
          <p className={panels.panelText}>
            {state.emailed ? `We emailed an invite to ${state.email}. ` : ""}
            Send them this link too if you like. It works for 14 days, only for {state.email}.
          </p>
          <CopyLink link={state.link} />
        </div>
      )}
    </form>
  );
}

// Small buttons that run one action and show its error next to them.
function useRun() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (work: () => Promise<TeamResult>, after?: () => void) =>
    startTransition(async () => {
      setError(null);
      const result = await work();
      if (!result.ok) setError(result.error);
      else {
        after?.();
        router.refresh();
      }
    });
  return { pending, error, run };
}

export function MemberControls({ memberId, role, name }: { memberId: string; role: "editor" | "viewer"; name: string }) {
  const { pending, error, run } = useRun();
  const [confirming, setConfirming] = useState(false);
  return (
    <div className={styles.actions}>
      <select
        className={styles.select}
        aria-label={`What ${name} can do`}
        value={role}
        disabled={pending}
        onChange={(event) => run(() => changeRole(memberId, event.target.value))}
      >
        <option value="editor">Edit</option>
        <option value="viewer">View only</option>
      </select>
      {confirming ? (
        <>
          <button type="button" className={`${editor.button} ${panels.dangerButton}`} disabled={pending} onClick={() => run(() => removeMember(memberId))}>
            {pending ? "Removing…" : "Remove"}
          </button>
          <button type="button" className={`${editor.button} ${editor.secondary}`} disabled={pending} onClick={() => setConfirming(false)}>
            Keep
          </button>
        </>
      ) : (
        <button type="button" className={`${editor.button} ${editor.secondary}`} onClick={() => setConfirming(true)}>
          Remove…
        </button>
      )}
      {error && (
        <span role="alert" className={editor.actionError}>
          {error}
        </span>
      )}
    </div>
  );
}

export function InviteControls({ inviteId }: { inviteId: string }) {
  const { pending, error, run } = useRun();
  return (
    <div className={styles.actions}>
      <button type="button" className={`${editor.button} ${editor.secondary}`} disabled={pending} onClick={() => run(() => cancelInvite(inviteId))}>
        {pending ? "Cancelling…" : "Cancel invite"}
      </button>
      {error && (
        <span role="alert" className={editor.actionError}>
          {error}
        </span>
      )}
    </div>
  );
}

export function MembershipControls({ ownerId, current, teamName }: { ownerId: string; current: boolean; teamName: string }) {
  const router = useRouter();
  const { pending, error, run } = useRun();
  const [confirming, setConfirming] = useState(false);
  return (
    <div className={styles.actions}>
      {current ? (
        <button type="button" className={`${editor.button} ${editor.secondary}`} disabled={pending} onClick={() => run(() => switchWorkspace(""))}>
          Back to my workspace
        </button>
      ) : (
        <button type="button" className={editor.button} disabled={pending} onClick={() => run(() => switchWorkspace(ownerId), () => router.push("/dashboard"))}>
          Open {teamName}
        </button>
      )}
      {confirming ? (
        <>
          <button type="button" className={`${editor.button} ${panels.dangerButton}`} disabled={pending} onClick={() => run(() => leaveTeam(ownerId))}>
            {pending ? "Leaving…" : "Leave team"}
          </button>
          <button type="button" className={`${editor.button} ${editor.secondary}`} disabled={pending} onClick={() => setConfirming(false)}>
            Stay
          </button>
        </>
      ) : (
        <button type="button" className={`${editor.button} ${editor.secondary}`} onClick={() => setConfirming(true)}>
          Leave…
        </button>
      )}
      {error && (
        <span role="alert" className={editor.actionError}>
          {error}
        </span>
      )}
    </div>
  );
}
