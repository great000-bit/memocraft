"use client";

import { useState, useTransition } from "react";
import { checkDomain, connectDomain, removeDomain, setHideBranding, type BrandingResult } from "@/lib/branding-actions";
import editor from "@/components/deliveries/Editor.module.css";
import styles from "./Settings.module.css";

function useAction() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<BrandingResult | null>(null);
  const run = (task: () => Promise<BrandingResult>) =>
    startTransition(async () => {
      try {
        setResult(await task());
      } catch {
        setResult({ ok: false, error: "Could not save that. Try again." });
      }
    });
  return { pending, result, run };
}

function Outcome({ result }: { result: BrandingResult | null }) {
  if (!result) return null;
  if (!result.ok)
    return (
      <p role="alert" className={styles.error}>
        {result.error}
      </p>
    );
  return result.message ? (
    <p role="status" className={styles.hint}>
      {result.message}
    </p>
  ) : null;
}

export function HideBrandingForm({ hidden }: { hidden: boolean }) {
  const { pending, result, run } = useAction();
  const [on, setOn] = useState(hidden);
  return (
    <div className={styles.form}>
      <label className={styles.checkRow}>
        <input
          type="checkbox"
          checked={on}
          disabled={pending}
          onChange={(event) => {
            const next = event.target.checked;
            setOn(next);
            run(async () => {
              const outcome = await setHideBranding(next);
              if (!outcome.ok) setOn(!next);
              return outcome;
            });
          }}
        />
        <span>Hide &ldquo;Sent with Memocraft&rdquo; on my client pages</span>
      </label>
      <Outcome result={result} />
    </div>
  );
}

export function CustomDomainForm({ domain, status }: { domain: string | null; status: "pending" | "active" | null }) {
  const { pending, result, run } = useAction();
  const [value, setValue] = useState(domain ?? "");
  const sub = (domain ?? value).split(".")[0] || "files";

  if (domain) {
    return (
      <div className={styles.form}>
        <dl className={styles.facts}>
          <div className={styles.fact}>
            <dt>Your address</dt>
            <dd>{domain}</dd>
          </div>
          <div className={styles.fact}>
            <dt>Status</dt>
            <dd>{status === "active" ? "Working. New links use it." : "Waiting for your DNS"}</dd>
          </div>
        </dl>
        {status !== "active" && (
          <ol className={styles.steps}>
            <li>
              Open the DNS settings where you bought <b>{domain.split(".").slice(1).join(".")}</b>.
            </li>
            <li>
              Add a <b>CNAME</b> record with the name <b>{sub}</b> and the value <b>cname.vercel-dns.com</b>.
            </li>
            <li>Come back and press Check again. It can take up to a day to start working.</li>
          </ol>
        )}
        <Outcome result={result} />
        <div className={styles.buttonRow}>
          {status !== "active" && (
            <button type="button" className={`${editor.button} ${editor.primary}`} disabled={pending} onClick={() => run(checkDomain)}>
              {pending ? "Checking…" : "Check again"}
            </button>
          )}
          <button
            type="button"
            className={`${editor.button} ${editor.secondary}`}
            disabled={pending}
            onClick={() => {
              if (window.confirm("Links sent on this address will stop working there. Remove it?")) run(removeDomain);
            }}
          >
            Remove address
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        run(() => connectDomain(value));
      }}
    >
      <div className={styles.field}>
        <label htmlFor="customDomain" className={styles.label}>
          Your web address for client links
        </label>
        <input
          id="customDomain"
          className={styles.input}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="files.yourstudio.com"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          inputMode="url"
        />
        <p className={styles.hint}>Use a subdomain, so your main website keeps working. Clients then see your address, not ours.</p>
      </div>
      <Outcome result={result} />
      <div className={styles.buttonRow}>
        <button type="submit" className={`${editor.button} ${editor.primary}`} disabled={pending || !value.trim()}>
          {pending ? "Connecting…" : "Connect address"}
        </button>
      </div>
    </form>
  );
}
