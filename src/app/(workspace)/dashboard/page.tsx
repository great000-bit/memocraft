import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/Button";
import { FeatureIcon } from "@/components/FeatureIcons";
import { DeliveryList } from "@/components/deliveries/DeliveryList";
import { listDeliveries } from "@/lib/deliveries";
import { countOpenRequests } from "@/lib/requests";
import { requireUser } from "@/lib/session";
import { Avatar } from "@/components/workspace/Avatar";
import { StatCards, StatCardsFallback } from "@/components/workspace/StatCards";
import styles from "@/components/workspace/Workspace.module.css";

async function Greeting() {
  const user = await requireUser();
  const first = user.name.trim().split(/\s+/)[0] || "there";
  return (
    <div className={styles.greeting}>
      <Avatar name={user.name} image={user.image} size={52} />
      <h1 className={styles.heading}>Welcome back, {first}</h1>
    </div>
  );
}

// A line, not a card: the three cards stay the three things the dashboard is about. It only shows when someone is waiting.
async function WaitingRequests() {
  const user = await requireUser();
  const open = await countOpenRequests(user.id);
  if (open === 0) return null;
  return (
    <Link href="/requests" className={styles.requestsNotice}>
      <FeatureIcon name="request" />
      <span>
        {open === 1 ? "1 client request is waiting for you" : `${open} client requests are waiting for you`}
      </span>
      <span className={styles.requestsView}>View</span>
    </Link>
  );
}

async function Recent() {
  const user = await requireUser();
  const deliveries = await listDeliveries(user.id, 6);

  if (deliveries.length === 0) {
    return (
      <section className={styles.empty} aria-labelledby="empty-title">
        <span className={styles.emptyIcon}>
          <FeatureIcon name="upload" />
        </span>
        <h2 id="empty-title" className={styles.emptyTitle}>
          Your first delivery starts here
        </h2>
        <p className={styles.emptyBody}>
          Name it, add a note to each file so your client knows what it is for, and share one link. No account needed on
          their side.
        </p>
        <div className={styles.emptyAction}>
          <Button href="/deliveries/new">Send your first delivery</Button>
        </div>
      </section>
    );
  }

  return (
    <>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionLabel}>Recent deliveries</h2>
        <Link href="/deliveries" className={styles.sectionLink}>
          View all
        </Link>
      </div>
      <DeliveryList deliveries={deliveries} />
    </>
  );
}

export default function DashboardPage() {
  return (
    <>
      <div className={styles.headRow}>
        <Suspense fallback={<h1 className={styles.heading}>Welcome</h1>}>
          <Greeting />
        </Suspense>
        <Button href="/deliveries/new">New delivery</Button>
      </div>
      <p className={styles.sub}>Your deliveries live here. Each one is a single link your clients open on any phone.</p>
      <Suspense fallback={null}>
        <WaitingRequests />
      </Suspense>
      <Suspense fallback={<StatCardsFallback />}>
        <StatCards />
      </Suspense>
      <Suspense fallback={null}>
        <Recent />
      </Suspense>
    </>
  );
}
