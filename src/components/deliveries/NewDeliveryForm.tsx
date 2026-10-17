"use client";

import { useActionState } from "react";
import { createDelivery, type ActionResult } from "@/lib/delivery-actions";
import { limits } from "@/lib/delivery-limits";
import styles from "./Editor.module.css";

export function NewDeliveryForm() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(createDelivery, null);
  return (
    <form action={formAction} className={styles.newForm}>
      <div className={styles.field}>
        <label htmlFor="title" className={styles.label}>
          Delivery name
        </label>
        <input
          id="title"
          name="title"
          className={`${styles.input} ${styles.plain}`}
          maxLength={limits.title}
          placeholder="Spring Lookbook"
          required
          autoFocus
        />
        <p className={styles.hint}>Your client sees this at the top of the page.</p>
      </div>
      <div className={styles.field}>
        <label htmlFor="clientName" className={styles.label}>
          Client <span className={styles.optional}>(optional)</span>
        </label>
        <input
          id="clientName"
          name="clientName"
          className={`${styles.input} ${styles.plain}`}
          maxLength={limits.clientName}
          placeholder="Studio Marlow"
        />
      </div>
      {state && !state.ok && (
        <p role="alert" className={styles.formError}>
          {state.error}
        </p>
      )}
      <button type="submit" className={`${styles.button} ${styles.primary} ${styles.wide}`} disabled={pending}>
        {pending ? "Creating…" : "Create delivery"}
      </button>
    </form>
  );
}
