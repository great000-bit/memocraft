"use client";

import Link from "next/link";
import { useEffect } from "react";
import { line, noticeHref, type NoticeKind } from "@/lib/notice-text";
import { FeatureIcon } from "../FeatureIcons";
import { LocalTime } from "../deliveries/LocalTime";
import { unreadEvent } from "./Notifier";
import styles from "./Notifications.module.css";

export type NoticeRow = {
  id: string;
  kind: NoticeKind;
  deliveryId: string;
  title: string;
  clientName: string | null;
  device: string | null;
  fileName: string | null;
  count: number;
  at: string;
  isNew: boolean;
};

const icons = {
  open: "proof",
  download: "upload",
  request: "request",
  approval: "approve",
  comment: "comment",
  favourite: "heart",
  reminder: "nudge",
  reminded: "nudge",
} as const;

// Opening the page marks everything on it as read; the lines stay marked new until the next visit, so you can see
// what you missed.
export function NotificationList({ notices }: { notices: NoticeRow[] }) {
  useEffect(() => {
    fetch("/api/notifications/seen", { method: "POST" })
      .then(() => window.dispatchEvent(new CustomEvent(unreadEvent, { detail: 0 })))
      .catch(() => {});
  }, []);

  if (notices.length === 0) {
    return (
      <p className={styles.empty}>
        Nothing yet. When a client opens one of your links, saves, approves or comments on files, or asks for something, it shows up here.
      </p>
    );
  }

  return (
    <ul className={styles.list}>
      {notices.map((notice) => (
        <li key={notice.id} className={styles.item} data-kind={notice.kind} data-new={notice.isNew || undefined}>
          <Link href={noticeHref(notice)} className={styles.link}>
            <span className={styles.icon} aria-hidden="true">
              <FeatureIcon name={icons[notice.kind]} />
            </span>
            <span className={styles.text}>
              <span className={styles.line}>{line(notice)}</span>
              <span className={styles.meta}>
                {notice.kind === "open" ? notice.device && `On ${notice.device} · ` : `${notice.title} · `}
                <LocalTime iso={notice.at} />
              </span>
            </span>
            {notice.isNew && <span className={styles.dot} role="img" aria-label="New" />}
          </Link>
        </li>
      ))}
    </ul>
  );
}
