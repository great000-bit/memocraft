"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

const asUtc = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
const asLocal = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

// The server does not know the viewer's time zone, so it sends UTC and the browser swaps in local time.
export function LocalTime({ iso }: { iso: string }) {
  const date = new Date(iso);
  const text = useSyncExternalStore(
    noopSubscribe,
    () => asLocal.format(date),
    () => `${asUtc.format(date)} UTC`,
  );
  return <time dateTime={iso}>{text}</time>;
}
