import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Ago, DayBars, Feed, Meter, PanelSkeleton, StatCard, UserChip, plural, size } from "@/components/admin/AdminParts";
import { getDailyCounts, getHealth, getOverview, listAudit, listFeed, listUsers } from "@/lib/admin-data";
import { storageStatus } from "@/lib/storage";
import { formatSize, storageLimits } from "@/lib/storage-limits";
import { StatCardsFallback } from "@/components/workspace/StatCards";
import cards from "@/components/workspace/Dashboard.module.css";
import workspace from "@/components/workspace/Workspace.module.css";
import styles from "@/components/admin/Admin.module.css";

export const metadata: Metadata = { title: "Overview" };

async function Numbers() {
  const o = await getOverview();
  return (
    <div className={cards.cardsWrap}>
      <div className={`${cards.cards} ${styles.sixCards}`}>
        <StatCard
          label="People"
          icon="people"
          figure={o.users.toLocaleString("en")}
          unit={plural(o.users, "account", "accounts")}
          note={
            <>
              <span className={cards.chip}>+{o.newUsers7d}</span> new this week &middot; {o.active7d} active
            </>
          }
        />
        <StatCard
          label="Storage in use"
          icon="upload"
          featured
          figure={size(o.storageBytes)}
          unit={`across ${plural(o.files, "file", "files")}`}
          note={`Free tier on R2 is 10 GB; each account is capped at ${formatSize(storageLimits.accountBytes)}`}
        />
        <StatCard
          label="Deliveries"
          icon="file"
          figure={o.deliveries.toLocaleString("en")}
          unit={`${o.published} published`}
          note={`${o.deliveries - o.published} still drafts`}
        />
        <StatCard
          label="Client opens, 30 days"
          icon="proof"
          figure={o.opens30d.toLocaleString("en")}
          unit={`${plural(o.downloads30d, "download", "downloads")}`}
        />
        <StatCard
          label="Open client requests"
          icon="request"
          figure={o.openRequests.toLocaleString("en")}
          unit="waiting on creatives"
        />
        <StatCard
          label="Phones with notifications"
          icon="bell"
          figure={o.pushDevices.toLocaleString("en")}
          unit={plural(o.pushDevices, "device", "devices")}
        />
      </div>
    </div>
  );
}

async function Charts() {
  const days = await getDailyCounts();
  return (
    <div className={styles.twoCol}>
      <DayBars title="Sign-ups" days={days} series={[{ key: "signups", label: "Sign-ups", tone: "teal" }]} />
      <DayBars
        title="Client activity"
        days={days}
        series={[
          { key: "downloads", label: "Downloads", tone: "teal" },
          { key: "opens", label: "Opens", tone: "amber" },
        ]}
      />
    </div>
  );
}

async function Recent() {
  const items = await listFeed({ limit: 12 });
  return (
    <section className={styles.panel}>
      <header className={styles.panelHead}>
        <h2 className={styles.panelTitle}>What just happened</h2>
        <Link href="/admin/activity" className={workspace.sectionLink}>
          All activity
        </Link>
      </header>
      <Feed items={items} />
    </section>
  );
}

async function TopStorage() {
  const { users } = await listUsers({ q: "", sort: "storage", page: 1 });
  const top = users.filter((u) => u.storageBytes > 0).slice(0, 5);
  return (
    <section className={styles.panel}>
      <header className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Most storage</h2>
        <Link href="/admin/users?sort=storage" className={workspace.sectionLink}>
          All people
        </Link>
      </header>
      {top.length === 0 ? (
        <p className={styles.emptyLine}>Nobody has uploaded anything yet.</p>
      ) : (
        <ul className={styles.rankList}>
          {top.map((u) => (
            <li key={u.id}>
              <UserChip id={u.id} name={u.name} email={u.email} image={u.image} />
              <span className={styles.rankFigure}>
                {size(u.storageBytes)}
                <Meter used={u.storageBytes} limit={storageLimits.accountBytes} label={`${u.name}'s storage`} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const storageText = { ok: "Connected", off: "Not set up", error: "Not reachable" } as const;

async function Health() {
  const [db, storage] = await Promise.all([getHealth(), storageStatus()]);
  return (
    <section className={styles.panel}>
      <header className={styles.panelHead}>
        <h2 className={styles.panelTitle}>System</h2>
      </header>
      <ul className={styles.health}>
        <li data-state={db.database === "ok" ? "ok" : "error"}>
          <span>Database</span>
          <b>{db.database === "ok" ? `Up, answered in ${db.latencyMs} ms` : "Not reachable"}</b>
        </li>
        <li data-state={storage === "ok" ? "ok" : storage === "off" ? "warn" : "error"}>
          <span>File storage</span>
          <b>{storageText[storage]}</b>
        </li>
      </ul>
    </section>
  );
}

async function AuditLog() {
  const rows = await listAudit();
  return (
    <section className={styles.panel}>
      <header className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Admin log</h2>
      </header>
      <p className={styles.panelNote}>Every time an admin opens someone&rsquo;s account page, it is written here.</p>
      {rows.length === 0 ? (
        <p className={styles.emptyLine}>No account has been looked at yet.</p>
      ) : (
        <ul className={styles.audit}>
          {rows.map((row) => (
            <li key={row.id}>
              <span>
                <b>{row.adminEmail}</b> viewed {row.targetName ?? "a deleted account"}
              </span>
              <Ago at={row.at} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function AdminOverview() {
  return (
    <>
      <div className={workspace.headRow}>
        <h1 className={workspace.heading}>Everything in Memocraft</h1>
      </div>
      <p className={workspace.sub}>Every account, delivery and client visit across the app. Names and counts only, never what is inside the files.</p>
      <Suspense fallback={<StatCardsFallback />}>
        <Numbers />
      </Suspense>
      <Suspense fallback={<div className={styles.twoCol}><PanelSkeleton /><PanelSkeleton /></div>}>
        <Charts />
      </Suspense>
      <div className={styles.split}>
        <Suspense fallback={<PanelSkeleton height={480} />}>
          <Recent />
        </Suspense>
        <div className={styles.stack}>
          <Suspense fallback={<PanelSkeleton height={140} />}>
            <Health />
          </Suspense>
          <Suspense fallback={<PanelSkeleton />}>
            <TopStorage />
          </Suspense>
          <Suspense fallback={<PanelSkeleton />}>
            <AuditLog />
          </Suspense>
        </div>
      </div>
    </>
  );
}
