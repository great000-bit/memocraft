import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Ago, Meter, PanelSkeleton, UserChip, plural, providerName, size } from "@/components/admin/AdminParts";
import { listUsers, userSorts, usersPerPage, type UserSort } from "@/lib/admin-data";
import { storageLimits } from "@/lib/storage-limits";
import workspace from "@/components/workspace/Workspace.module.css";
import styles from "@/components/admin/Admin.module.css";

export const metadata: Metadata = { title: "People" };

type Search = { q?: string; sort?: string; page?: string };

function hrefWith(current: Search, change: Search) {
  const params = new URLSearchParams();
  const next = { ...current, ...change };
  if (next.q) params.set("q", next.q);
  if (next.sort && next.sort !== "newest") params.set("sort", next.sort);
  if (next.page && next.page !== "1") params.set("page", next.page);
  const query = params.toString();
  return query ? `/admin/users?${query}` : "/admin/users";
}

async function Users({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
  const q = one(raw.q).trim().slice(0, 100);
  const sort: UserSort = one(raw.sort) in userSorts ? (one(raw.sort) as UserSort) : "newest";
  const page = Math.max(1, Math.floor(Number(one(raw.page)) || 1));
  const current: Search = { q, sort, page: String(page) };
  const { users, total } = await listUsers({ q, sort, page });
  const pages = Math.max(1, Math.ceil(total / usersPerPage));

  return (
    <>
      <div className={styles.toolbar}>
        <form action="/admin/users" className={styles.search} role="search">
          <input type="search" name="q" defaultValue={q} placeholder="Search name or email" aria-label="Search name or email" />
          {sort !== "newest" && <input type="hidden" name="sort" value={sort} />}
          <button type="submit">Search</button>
        </form>
        <nav className={styles.chips} aria-label="Sort by">
          {(Object.keys(userSorts) as UserSort[]).map((key) => (
            <Link key={key} href={hrefWith(current, { sort: key, page: "1" })} aria-current={key === sort ? "true" : undefined}>
              {userSorts[key]}
            </Link>
          ))}
        </nav>
      </div>
      <p className={styles.count}>
        {q ? `${plural(total, "match", "matches")} for “${q}”` : plural(total, "account", "accounts")}
      </p>

      {users.length === 0 ? (
        <p className={styles.emptyLine}>{q ? "Nobody matches that search." : "No accounts yet."}</p>
      ) : (
        <div className={styles.table} role="table" aria-label="People">
          <div className={styles.tableHead} role="row">
            <span role="columnheader">Person</span>
            <span role="columnheader">Signs in with</span>
            <span role="columnheader">Joined</span>
            <span role="columnheader">Last active</span>
            <span role="columnheader">Deliveries</span>
            <span role="columnheader">Storage</span>
          </div>
          {users.map((u) => (
            <div key={u.id} className={styles.tableRow} role="row">
              <span role="cell" className={styles.cellPerson}>
                <UserChip id={u.id} name={u.name} email={u.email} image={u.image} />
              </span>
              <span role="cell" data-label="Signs in with">
                <span className={styles.badges}>
                  {u.providers.map((p) => (
                    <span key={p} className={styles.badge} data-provider={p}>
                      {providerName(p)}
                    </span>
                  ))}
                  {!u.emailVerified && <span className={styles.badge} data-tone="warn">Unconfirmed</span>}
                </span>
              </span>
              <span role="cell" data-label="Joined">
                <Ago at={u.createdAt} />
              </span>
              <span role="cell" data-label="Last active">
                {u.lastActive ? <Ago at={u.lastActive} /> : "Never"}
              </span>
              <span role="cell" data-label="Deliveries">
                <span>
                  <b>{u.deliveries}</b> <span className={styles.muted}>({u.published} live)</span>
                </span>
              </span>
              <span role="cell" data-label="Storage">
                <span className={styles.cellStorage}>
                  <span>
                    <b>{size(u.storageBytes)}</b> <span className={styles.muted}>{plural(u.files, "file", "files")}</span>
                  </span>
                  <Meter used={u.storageBytes} limit={storageLimits.accountBytes} label={`${u.name}'s storage`} />
                </span>
              </span>
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <nav className={styles.pager} aria-label="Pages">
          {page > 1 ? <Link href={hrefWith(current, { page: String(page - 1) })}>Previous</Link> : <span />}
          <span>
            Page {page} of {pages}
          </span>
          {page < pages ? <Link href={hrefWith(current, { page: String(page + 1) })}>Next</Link> : <span />}
        </nav>
      )}
    </>
  );
}

export default function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  return (
    <>
      <div className={workspace.headRow}>
        <h1 className={workspace.heading}>People</h1>
      </div>
      <p className={workspace.sub}>Everyone with an account, what they have sent and how much room they use.</p>
      <Suspense fallback={<PanelSkeleton height={420} />}>
        <Users searchParams={searchParams} />
      </Suspense>
    </>
  );
}
