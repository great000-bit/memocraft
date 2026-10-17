import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Ago, Feed, Meter, PanelSkeleton, plural, providerName, size } from "@/components/admin/AdminParts";
import { Avatar } from "@/components/workspace/Avatar";
import { LocalTime } from "@/components/deliveries/LocalTime";
import { recordAdminView, requireAdmin } from "@/lib/admin";
import { getUserDetail, listFeed, listUserDeliveries, type AdminDelivery } from "@/lib/admin-data";
import cards from "@/components/workspace/Dashboard.module.css";
import workspace from "@/components/workspace/Workspace.module.css";
import styles from "@/components/admin/Admin.module.css";

export const metadata: Metadata = { title: "Account" };

function linkState(d: AdminDelivery): { label: string; tone: string } {
  if (d.status === "draft") return { label: d.publishedAt ? "Paused" : "Draft", tone: "muted" };
  if (d.expiresAt && new Date(d.expiresAt) <= new Date()) return { label: "Expired", tone: "warn" };
  return { label: "Live", tone: "ok" };
}

async function Account({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const admin = await requireAdmin();
  const { id } = await params;
  const user = await getUserDetail(id);
  if (!user) notFound();
  // Looking at an account is written down before anything about it is shown.
  await recordAdminView(admin, user.id);
  const [deliveries, activity] = await Promise.all([listUserDeliveries(user.id), listFeed({ userId: user.id, limit: 20 })]);
  const used = user.storage.fileBytes + user.storage.versionBytes;

  return (
    <>
      <Link href="/admin/users" className={styles.back}>
        &larr; All people
      </Link>
      <div className={styles.profileHead}>
        <Avatar name={user.name} image={user.image} size={72} />
        <div className={styles.profileText}>
          <h1 className={workspace.heading}>{user.name}</h1>
          <p className={styles.profileEmail}>{user.email}</p>
          <span className={styles.badges}>
            {user.providers.map((p) => (
              <span key={p} className={styles.badge} data-provider={p}>
                {providerName(p)}
              </span>
            ))}
            <span className={styles.badge} data-tone={user.emailVerified ? "ok" : "warn"}>
              {user.emailVerified ? "Email confirmed" : "Email not confirmed"}
            </span>
          </span>
        </div>
      </div>

      <div className={cards.cardsWrap}>
        <div className={cards.cards}>
          <article className={`${cards.card} ${cards.featured}`}>
            <h2 className={cards.label}>Storage</h2>
            <p className={cards.figure}>
              {size(used)}
              <span className={cards.unit}>of {size(user.storage.limitBytes)}</span>
            </p>
            <Meter used={used} limit={user.storage.limitBytes} label="Storage used" />
            <p className={cards.note}>
              {plural(user.storage.files, "file", "files")} ({size(user.storage.fileBytes)}) &middot;{" "}
              {plural(user.storage.versions, "earlier version", "earlier versions")} ({size(user.storage.versionBytes)})
            </p>
            <p className={cards.note}>
              {plural(user.storage.thumbs, "preview picture", "preview pictures")}
              {user.storage.uploading > 0 && <> &middot; {user.storage.uploading} uploading now</>}
            </p>
          </article>
          <article className={cards.card}>
            <h2 className={cards.label}>Account</h2>
            <dl className={styles.facts}>
              <dt>Joined</dt>
              <dd>
                <LocalTime iso={new Date(user.createdAt).toISOString()} />
              </dd>
              <dt>Last active</dt>
              <dd>{user.lastActive ? <Ago at={user.lastActive} /> : "Never"}</dd>
              <dt>Studio name</dt>
              <dd>{user.studioName ?? "Uses their own name"}</dd>
              <dt>Studio logo</dt>
              <dd>{user.hasStudioLogo ? "Uploaded" : "None"}</dd>
            </dl>
          </article>
          <article className={cards.card}>
            <h2 className={cards.label}>Devices</h2>
            <dl className={styles.facts}>
              <dt>Signed in on</dt>
              <dd>{user.sessionDevices.length ? user.sessionDevices.join(", ") : "Signed out everywhere"}</dd>
              <dt>Live sessions</dt>
              <dd>{user.activeSessions}</dd>
              <dt>Phone notifications</dt>
              <dd>{user.pushDevices.length ? user.pushDevices.join(", ") : "Off"}</dd>
            </dl>
          </article>
        </div>
      </div>

      <div className={workspace.sectionHead}>
        <h2 className={workspace.sectionLabel}>Deliveries</h2>
        <span className={styles.muted}>{plural(deliveries.length, "delivery", "deliveries")}{deliveries.length === 50 ? " (newest 50)" : ""}</span>
      </div>
      {deliveries.length === 0 ? (
        <p className={styles.emptyLine}>No deliveries yet.</p>
      ) : (
        <div className={`${styles.table} ${styles.deliveryTable}`} role="table" aria-label="Deliveries">
          <div className={styles.tableHead} role="row">
            <span role="columnheader">Delivery</span>
            <span role="columnheader">Link</span>
            <span role="columnheader">Files</span>
            <span role="columnheader">Opens</span>
            <span role="columnheader">Downloads</span>
            <span role="columnheader">Requests</span>
          </div>
          {deliveries.map((d) => {
            const state = linkState(d);
            return (
              <div key={d.id} className={styles.tableRow} role="row">
                <span role="cell" className={styles.cellPerson}>
                  <span className={styles.deliveryName}>
                    <b>{d.title}</b>
                    <span className={styles.muted}>
                      {d.clientName ? `for ${d.clientName} · ` : ""}
                      made <Ago at={d.createdAt} />
                    </span>
                  </span>
                </span>
                <span role="cell" data-label="Link">
                  <span className={styles.badges}>
                    <span className={styles.badge} data-tone={state.tone}>
                      {state.label}
                    </span>
                    {d.hasPassword && <span className={styles.badge}>Password</span>}
                  </span>
                </span>
                <span role="cell" data-label="Files">
                  <span>
                    <b>{d.files}</b> <span className={styles.muted}>{size(d.bytes)}</span>
                  </span>
                </span>
                <span role="cell" data-label="Opens">
                  <b>{d.opens}</b>
                </span>
                <span role="cell" data-label="Downloads">
                  <b>{d.downloads}</b>
                </span>
                <span role="cell" data-label="Requests">
                  {d.openRequests > 0 ? <span className={styles.badge} data-tone="warn">{d.openRequests} open</span> : <span className={styles.muted}>None</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className={workspace.sectionHead}>
        <h2 className={workspace.sectionLabel}>Recent activity</h2>
        <Link href={`/admin/activity?user=${user.id}`} className={workspace.sectionLink}>
          All of it
        </Link>
      </div>
      <section className={styles.panel}>
        <Feed items={activity} empty="Nothing has happened on this account yet." />
      </section>
    </>
  );
}

export default function AccountPage({ params }: PageProps<"/admin/users/[id]">) {
  return (
    <Suspense fallback={<PanelSkeleton height={520} />}>
      <Account params={params} />
    </Suspense>
  );
}
