"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogoMark } from "@/components/Logo";
import { line } from "@/lib/notice-text";
import styles from "./Notifier.module.css";

// Live notes in the corner of the workspace when a client opens a delivery, saves files or asks for something,
// like the one at the end of the walkthrough on the landing page. It asks the server every 20 seconds while the tab
// is in view, and once when you come back to it, so things that happened while you were away show up too.

type Notice = {
  id: string;
  kind: "open" | "download" | "request";
  deliveryId: string;
  title: string;
  clientName: string | null;
  device: string | null;
  fileName: string | null;
  count: number;
  at: string;
};

type Toast = Notice & { leaving?: boolean };

export const unreadEvent = "mc-unread";
const cursorKey = "mc-notice-cursor";
const seenKey = "mc-notice-seen";
const every = 20_000;
const overlap = 2 * 60_000; // ask a little further back each time, so a slow "Save all" is never cut in half
const showFor = 8_000;
const most = 3;

function when(at: string) {
  const minutes = Math.round((Date.now() - new Date(at).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)} h ago`;
  return new Date(at).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function detail(notice: Notice) {
  if (notice.kind === "open") return [notice.device && `On ${notice.device}`, when(notice.at)].filter(Boolean).join(" · ");
  return `${notice.title} · ${when(notice.at)}`;
}

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private windows can refuse storage; notices then start fresh on each visit.
  }
}

export function Notifier() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [more, setMore] = useState(0);
  const router = useRouter();
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  function dismiss(id: string) {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((list) => list.map((toast) => (toast.id === id ? { ...toast, leaving: true } : toast)));
    setTimeout(() => setToasts((list) => list.filter((toast) => toast.id !== id)), 320);
    setMore(0);
  }

  const dismissRef = useRef(dismiss);
  useEffect(() => {
    dismissRef.current = dismiss;
  });

  useEffect(() => {
    let stopped = false;
    let busy = false;
    let seen: string[] = [];
    try {
      seen = JSON.parse(read(seenKey) ?? "[]");
    } catch {
      seen = [];
    }

    async function check() {
      if (busy || stopped || document.hidden) return;
      busy = true;
      try {
        const cursor = read(cursorKey);
        const after = cursor ? new Date(new Date(cursor).getTime() - overlap).toISOString() : "";
        const response = await fetch(`/api/notifications?after=${encodeURIComponent(after)}`, { cache: "no-store" });
        if (!response.ok || stopped) return;
        const { now, notices, unread } = (await response.json()) as { now: string; notices: Notice[]; unread: number };
        write(cursorKey, now);
        // The sidebar's Notifications link shows a dot while there is something new on that page.
        window.dispatchEvent(new CustomEvent(unreadEvent, { detail: unread }));
        const fresh = notices.filter((notice) => !seen.includes(notice.id));
        if (fresh.length === 0) return;
        seen = [...fresh.map((notice) => notice.id), ...seen].slice(0, 200);
        write(seenKey, JSON.stringify(seen));
        const shown = fresh.slice(0, most);
        setMore(fresh.length - shown.length);
        setToasts((list) => [...shown, ...list].slice(0, most));
        for (const toast of shown) {
          timers.current.set(
            toast.id,
            setTimeout(() => dismissRef.current(toast.id), showFor),
          );
        }
        // The numbers on the page move with the news.
        router.refresh();
      } catch {
        // Offline or the server is waking up: the next check tries again.
      } finally {
        busy = false;
      }
    }

    check();
    const interval = setInterval(check, every);
    const onVisible = () => {
      if (!document.hidden) check();
    };
    document.addEventListener("visibilitychange", onVisible);
    const pending = timers.current;
    return () => {
      stopped = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      for (const timer of pending.values()) clearTimeout(timer);
    };
  }, [router]);

  return (
    <div className={styles.stack} aria-live="polite" aria-label="Notifications">
      {toasts.map((toast) => (
        <div key={toast.id} className={styles.toast} data-leaving={toast.leaving || undefined} data-kind={toast.kind}>
          <Link
            href={toast.kind === "request" ? "/requests" : `/deliveries/${toast.deliveryId}`}
            className={styles.body}
            onClick={() => dismiss(toast.id)}
          >
            <span className={styles.mark} aria-hidden="true">
              <LogoMark className={styles.markSvg} title="" />
            </span>
            <span className={styles.text}>
              <b>{line(toast)}</b>
              <span>{detail(toast)}</span>
            </span>
          </Link>
          <button type="button" className={styles.close} aria-label="Dismiss" onClick={() => dismiss(toast.id)}>
            ×
          </button>
        </div>
      ))}
      {more > 0 && toasts.length > 0 && (
        <Link href="/deliveries" className={styles.more} onClick={() => setMore(0)}>
          and {more} more on your deliveries
        </Link>
      )}
    </div>
  );
}
