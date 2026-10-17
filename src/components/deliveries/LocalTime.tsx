"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

const asUtc = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
const asLocal = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const dayUtc = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });
const dayLocal = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

// The server does not know the viewer's time zone, so it sends UTC and the browser swaps in local time.
export function LocalTime({ iso, dateOnly = false }: { iso: string; dateOnly?: boolean }) {
  const date = new Date(iso);
  const text = useSyncExternalStore(
    noopSubscribe,
    () => (dateOnly ? dayLocal : asLocal).format(date),
    () => (dateOnly ? dayUtc.format(date) : `${asUtc.format(date)} UTC`),
  );
  return <time dateTime={iso}>{text}</time>;
}
