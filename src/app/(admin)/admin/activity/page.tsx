import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Feed, PanelSkeleton } from "@/components/admin/AdminParts";
import { feedKinds, feedPageSize, listFeed, type FeedKind } from "@/lib/admin-data";
import { pool } from "@/lib/auth";
import workspace from "@/components/workspace/Workspace.module.css";
import styles from "@/components/admin/Admin.module.css";

export const metadata: Metadata = { title: "Activity" };

async function Activity({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
  const kind = one(raw.kind) in feedKinds ? (one(raw.kind) as FeedKind) : null;
  const userId = one(raw.user) || null;
  const beforeDate = one(raw.before) ? new Date(one(raw.before)) : null;
  const before = beforeDate && !Number.isNaN(beforeDate.getTime()) ? beforeDate : null;

  const [items, person] = await Promise.all([
    listFeed({ kinds: kind ? [kind] : undefined, userId, before }),
    userId ? pool.query<{ name: string }>(`select "name" from "user" where "id" = $1`, [userId]).then((r) => r.rows[0] ?? null) : null,
  ]);

  const href = (change: { kind?: FeedKind | null; before?: string | null }) => {
    const params = new URLSearchParams();
    const nextKind = change.kind === undefined ? kind : change.kind;
    if (nextKind) params.set("kind", nextKind);
    if (userId) params.set("user", userId);
    if (change.before) params.set("before", change.before);
    const query = params.toString();
    return query ? `/admin/activity?${query}` : "/admin/activity";
  };
  const last = items.at(-1);

  return (
    <>
      <div className={styles.toolbar}>
        <nav className={styles.chips} aria-label="Show">
          <Link href={href({ kind: null })} aria-current={kind === null ? "true" : undefined}>
            Everything
          </Link>
          {(Object.keys(feedKinds) as FeedKind[]).map((key) => (
            <Link key={key} href={href({ kind: key })} aria-current={key === kind ? "true" : undefined}>
              {feedKinds[key]}
            </Link>
          ))}
        </nav>
        {userId && (
          <p className={styles.filterNote}>
            Only {person?.name ?? "a deleted account"} &middot; <Link href={kind ? `/admin/activity?kind=${kind}` : "/admin/activity"}>Show everyone</Link>
          </p>
        )}
      </div>
      <section className={styles.panel}>
        <Feed items={items} empty={before ? "Nothing older than this." : "Nothing has happened yet."} />
      </section>
      <nav className={styles.pager} aria-label="Pages">
        {before ? <Link href={href({})}>Back to newest</Link> : <span />}
        <span />
        {last && items.length === feedPageSize ? <Link href={href({ before: new Date(last.at).toISOString() })}>Older</Link> : <span />}
      </nav>
    </>
  );
}

export default function ActivityPage({ searchParams }: PageProps<"/admin/activity">) {
  return (
    <>
      <div className={workspace.headRow}>
        <h1 className={workspace.heading}>Activity</h1>
      </div>
      <p className={workspace.sub}>Sign-ups, published links, client opens, downloads and requests, newest first.</p>
      <Suspense fallback={<PanelSkeleton height={520} />}>
        <Activity searchParams={searchParams} />
      </Suspense>
    </>
  );
}
