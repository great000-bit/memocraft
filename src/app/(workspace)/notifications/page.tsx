import type { Metadata } from "next";
import { Suspense } from "react";
import { NotificationList } from "@/components/workspace/NotificationList";
import { PageSkeleton } from "@/components/workspace/PageSkeleton";
import { GetTheApp, PhoneNotifications } from "@/components/workspace/PhoneApp";
import { getSeenAt, listNotices } from "@/lib/notifications";
import { pushPublicKey } from "@/lib/push";
import { raiseDueReminders } from "@/lib/reminders";
import { requireUser } from "@/lib/session";
import panels from "@/components/workspace/Settings.module.css";
import list from "@/components/workspace/Notifications.module.css";
import styles from "@/components/workspace/Workspace.module.css";

export const metadata: Metadata = { title: "Notifications" };

async function History() {
  const user = await requireUser();
  await raiseDueReminders(user.id).catch((error) => console.error("Could not raise reminders:", error));
  const seenAt = await getSeenAt(user.id);
  const notices = await listNotices(user.id, new Date(0), { days: 30, limit: 60 });
  return (
    <NotificationList
      notices={notices.map((notice) => ({ ...notice, at: notice.at.toISOString(), isNew: notice.at > seenAt }))}
    />
  );
}

// The key is read on the server at request time, so turning push on in production needs no rebuild.
async function Phone() {
  await requireUser();
  return <PhoneNotifications publicKey={pushPublicKey()} />;
}

export default function NotificationsPage() {
  return (
    <>
      <div className={styles.headRow}>
        <h1 className={styles.heading}>Notifications</h1>
      </div>
      <p className={styles.sub}>Every time a client opened a link, saved, approved or commented on files, or asked for something, over the last 30 days. Reminders for clients who have not opened yet show here too.</p>
      <div className={panels.panels}>
        <GetTheApp />
        <Suspense fallback={<PageSkeleton blocks={1} />}>
          <Phone />
        </Suspense>
      </div>
      <h2 className={list.heading}>Recent</h2>
      <Suspense fallback={<PageSkeleton blocks={2} />}>
        <History />
      </Suspense>
    </>
  );
}
