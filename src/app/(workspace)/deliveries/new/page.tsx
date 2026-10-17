import type { Metadata } from "next";
import { NewDeliveryForm } from "@/components/deliveries/NewDeliveryForm";
import styles from "@/components/workspace/Workspace.module.css";

export const metadata: Metadata = { title: "New delivery" };

export default function NewDeliveryPage() {
  return (
    <>
      <h1 className={styles.heading}>New delivery</h1>
      <p className={styles.sub}>Name it now. You add the files and the notes next, and nothing is shared until you publish.</p>
      <div className={styles.formBlock}>
        <NewDeliveryForm />
      </div>
    </>
  );
}
