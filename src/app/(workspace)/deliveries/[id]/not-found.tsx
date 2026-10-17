import { Button } from "@/components/Button";
import styles from "@/components/workspace/Workspace.module.css";

export default function DeliveryNotFound() {
  return (
    <>
      <h1 className={styles.heading}>Delivery not found</h1>
      <p className={styles.sub}>It may have been removed, or it belongs to another account.</p>
      <div className={styles.emptyAction}>
        <Button href="/deliveries" variant="outline">
          Back to deliveries
        </Button>
      </div>
    </>
  );
}
