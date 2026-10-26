"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { canSaveToPhone, type SaveTarget } from "@/lib/save-to-phone";
import { SaveToPhone } from "./SaveToPhone";
import styles from "./ClientView.module.css";

const rowHeight = 4;
// A finger has to rest this long before a picture lifts, so an ordinary swipe still scrolls the page.
const holdMs = 360;
// How far a pointer may wander before a press counts as a swipe (touch) or a drag (mouse).
const slop = 8;
const edge = 90;

export type GalleryItem = {
  id: string;
  name: string;
  src: string;
  // Pictures on screen when the page opens load at once; the rest wait until the client scrolls to them.
  eager: boolean;
  priority: "high" | "auto";
  // New, Updated and Enhanced marks, drawn on the picture's corner.
  badge?: React.ReactNode;
  // Null while the link is not live (the owner's preview of a draft).
  href: string | null;
  save: SaveTarget | null;
};

const noopSubscribe = () => () => {};

// Stars are the client's own picks, kept in this browser for this link. Every section reads the same list.
const starListeners = new Set<() => void>();
const starCache = new Map<string, string>();
const starKey = (slug: string) => `mc-stars:${slug}`;

function readStars(slug: string): string {
  if (!starCache.has(slug)) {
    let saved = "";
    try {
      saved = localStorage.getItem(starKey(slug)) ?? "";
    } catch {}
    starCache.set(slug, saved);
  }
  return starCache.get(slug) as string;
}

function toggleStar(slug: string, id: string) {
  const stars = new Set(readStars(slug).split(",").filter(Boolean));
  if (stars.has(id)) stars.delete(id);
  else stars.add(id);
  const next = [...stars].join(",");
  starCache.set(slug, next);
  try {
    localStorage.setItem(starKey(slug), next);
  } catch {}
  for (const listener of starListeners) listener();
}

function subscribeStars(listener: () => void) {
  starListeners.add(listener);
  return () => starListeners.delete(listener);
}

// The order the client arranged, kept the same way. Files added since then go at the end, in the sender's order.
const orderListeners = new Set<() => void>();
const orderCache = new Map<string, string>();
const orderKey = (slug: string, section: string) => `mc-order:${slug}:${section}`;

function readOrder(key: string): string {
  if (!orderCache.has(key)) {
    let saved = "";
    try {
      saved = localStorage.getItem(key) ?? "";
    } catch {}
    orderCache.set(key, saved);
  }
  return orderCache.get(key) as string;
}

function writeOrder(key: string, ids: string[] | null) {
  const next = ids ? ids.join(",") : "";
  orderCache.set(key, next);
  try {
    if (next) localStorage.setItem(key, next);
    else localStorage.removeItem(key);
  } catch {}
  for (const listener of orderListeners) listener();
}

function subscribeOrder(listener: () => void) {
  orderListeners.add(listener);
  return () => orderListeners.delete(listener);
}

function arrange(saved: string, ids: string[]): string[] {
  if (!saved) return ids;
  const known = new Set(ids);
  const kept = saved.split(",").filter((id) => known.has(id));
  const placed = new Set(kept);
  return [...kept, ...ids.filter((id) => !placed.has(id))];
}

function StarIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 5.5 20 11l-6 5.5V13c-4.5 0-7.5 1.3-10 5 .8-5 3.6-9 10-9.6z" />
    </svg>
  );
}

type Press = {
  id: string;
  pointerId: number;
  touch: boolean;
  x: number;
  y: number;
  timer: number | null;
};

type Drag = {
  id: string;
  pointerId: number;
  // Where the pointer holds the picture, so it does not jump to the pointer's tip.
  dx: number;
  dy: number;
  x: number;
  y: number;
  // The last picture the moved one went past, so it does not swap back and forth while the pointer rests on it.
  over: string | null;
};

// The pictures as a masonry: each keeps its own shape and the order still reads left to right, row by row. Every
// picture spans as many thin grid rows as it is tall, measured again whenever it changes (a picture arriving, the
// window resizing). Until this runs, and without scripts, the same list is a plain grid.
//
// The client can arrange the pictures: drag with a mouse, or hold one with a finger and move it. The order is kept in
// this browser for this link. Each picture carries three controls: star, download (save to the photo library on a
// phone that can) and share.
export function Gallery({ slug, section, items }: { slug: string; section: string; items: GalleryItem[] }) {
  const list = useRef<HTMLUListElement>(null);
  const ghost = useRef<HTMLDivElement>(null);
  const defaultOrder = items.map((item) => item.id);
  const key = orderKey(slug, section);
  const saved = useSyncExternalStore(subscribeOrder, () => readOrder(key), () => "");
  const [dragging, setDragging] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const press = useRef<Press | null>(null);
  const drag = useRef<Drag | null>(null);
  const scrollFrame = useRef(0);
  const toastTimer = useRef(0);
  const stars = useSyncExternalStore(subscribeStars, () => readStars(slug), () => "");
  const canSave = useSyncExternalStore(noopSubscribe, canSaveToPhone, () => false);
  const byId = new Map(items.map((item) => [item.id, item]));
  const shown = arrange(saved, defaultOrder);
  const defaultKey = defaultOrder.join();
  const arranged = shown.join() !== defaultKey;
  const starred = new Set(stars.split(",").filter(Boolean));

  useLayoutEffect(() => {
    const node = list.current;
    if (!node) return;
    const items = Array.from(node.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
    const place = (item: HTMLElement) => {
      const card = item.firstElementChild;
      if (!card) return;
      const gap = parseFloat(getComputedStyle(item).paddingBottom) || 0;
      item.style.gridRowEnd = `span ${Math.ceil((card.getBoundingClientRect().height + gap) / rowHeight)}`;
    };
    node.dataset.masonry = "";
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) if (entry.target.parentElement) place(entry.target.parentElement);
    });
    for (const item of items) {
      place(item);
      if (item.firstElementChild) observer.observe(item.firstElementChild);
    }
    return () => {
      observer.disconnect();
      delete node.dataset.masonry;
      for (const item of items) item.style.gridRowEnd = "";
    };
  }, [defaultKey]);

  const store = (next: string[]) => writeOrder(key, next.join() === defaultKey ? null : next);

  const say = useCallback((text: string) => {
    setToast(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  function moveTo(id: string, target: string) {
    const current = arrange(readOrder(key), defaultOrder);
    const from = current.indexOf(id);
    const to = current.indexOf(target);
    if (from < 0 || to < 0 || from === to) return;
    current.splice(from, 1);
    current.splice(to, 0, id);
    store(current);
  }

  function placeGhost() {
    const active = drag.current;
    if (!active || !ghost.current) return;
    ghost.current.style.transform = `translate3d(${active.x - active.dx}px, ${active.y - active.dy}px, 0) rotate(1.5deg) scale(1.04)`;
  }

  function lift(id: string, x: number, y: number, pointerId: number) {
    const item = list.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"]`);
    const card = item?.firstElementChild as HTMLElement | null;
    const node = ghost.current;
    if (!card || !node) return;
    const rect = card.getBoundingClientRect();
    drag.current = { id, pointerId, dx: x - rect.left, dy: y - rect.top, x, y, over: null };
    node.style.width = `${rect.width}px`;
    node.style.height = `${rect.height}px`;
    const img = node.querySelector("img");
    if (img) img.src = byId.get(id)?.src ?? "";
    placeGhost();
    setDragging(id);
    navigator.vibrate?.(8);
  }

  function follow(x: number, y: number) {
    const active = drag.current;
    if (!active) return;
    active.x = x;
    active.y = y;
    placeGhost();
    const under = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-id]");
    const target = under && list.current?.contains(under) ? under.dataset.id : undefined;
    if (!target || target === active.id) {
      active.over = null;
      return;
    }
    if (target === active.over) return;
    active.over = target;
    moveTo(active.id, target);
  }

  // Near the top or bottom of the screen the page scrolls, so a picture can travel the whole gallery.
  function autoScroll() {
    const active = drag.current;
    if (!active) return;
    const speed = active.y < edge ? -(edge - active.y) / 5 : active.y > innerHeight - edge ? (active.y - (innerHeight - edge)) / 5 : 0;
    if (speed) {
      scrollBy(0, speed);
      follow(active.x, active.y);
    }
    scrollFrame.current = requestAnimationFrame(autoScroll);
  }

  function drop() {
    if (press.current?.timer) window.clearTimeout(press.current.timer);
    press.current = null;
    if (!drag.current) return;
    drag.current = null;
    cancelAnimationFrame(scrollFrame.current);
    setDragging(null);
  }

  function onPointerDown(event: React.PointerEvent<HTMLUListElement>) {
    if (event.button !== 0 || drag.current) return;
    const target = event.target as HTMLElement;
    if (target.closest("button, a, [data-save]")) return;
    const item = target.closest<HTMLElement>("[data-id]");
    if (!item?.dataset.id) return;
    const touch = event.pointerType !== "mouse";
    const id = item.dataset.id;
    const { clientX: x, clientY: y, pointerId } = event;
    press.current = {
      id,
      pointerId,
      touch,
      x,
      y,
      timer: touch
        ? window.setTimeout(() => {
            if (press.current?.pointerId !== pointerId) return;
            press.current.timer = null;
            lift(id, press.current.x, press.current.y, pointerId);
            scrollFrame.current = requestAnimationFrame(autoScroll);
          }, holdMs)
        : null,
    };
  }

  // Moves and lifts are followed on the window, so a picture keeps up even when the pointer outruns it.
  useEffect(() => {
    function onMove(event: PointerEvent) {
      const pending = press.current;
      if (drag.current) {
        if (event.pointerId === drag.current.pointerId) follow(event.clientX, event.clientY);
        return;
      }
      if (!pending || pending.pointerId !== event.pointerId) return;
      const moved = Math.hypot(event.clientX - pending.x, event.clientY - pending.y) > slop;
      if (pending.touch) {
        // The finger moved before the hold: it is a scroll, not a drag.
        if (moved) drop();
        else {
          pending.x = event.clientX;
          pending.y = event.clientY;
        }
      } else if (moved) {
        lift(pending.id, pending.x, pending.y, pending.pointerId);
        scrollFrame.current = requestAnimationFrame(autoScroll);
        follow(event.clientX, event.clientY);
      }
    }
    function onUp(event: PointerEvent) {
      if (press.current?.pointerId === event.pointerId || drag.current?.pointerId === event.pointerId) drop();
    }
    // While a picture is held the finger moves it instead of scrolling the page. This has to be a touch listener
    // that is not passive: pointer events cannot stop a scroll once it starts.
    function onTouchMove(event: TouchEvent) {
      if (drag.current) event.preventDefault();
    }
    function onContextMenu(event: Event) {
      if (press.current?.touch || drag.current) event.preventDefault();
    }
    const node = list.current;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    node?.addEventListener("touchmove", onTouchMove, { passive: false });
    node?.addEventListener("contextmenu", onContextMenu);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      node?.removeEventListener("touchmove", onTouchMove);
      node?.removeEventListener("contextmenu", onContextMenu);
      cancelAnimationFrame(scrollFrame.current);
    };
  });

  // From the keyboard: Alt and an arrow move the focused picture one place.
  function onKeyDown(event: React.KeyboardEvent<HTMLLIElement>, id: string) {
    if (!event.altKey || event.target !== event.currentTarget) return;
    const step = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : 0;
    if (!step) return;
    event.preventDefault();
    const index = shown.indexOf(id);
    const target = shown[index + step];
    if (!target) return;
    const next = shown.slice();
    next.splice(index, 1);
    next.splice(index + step, 0, id);
    store(next);
    const item = byId.get(id);
    say(`${item?.name ?? "Picture"} moved to ${index + step + 1} of ${shown.length}`);
  }

  async function share(item: GalleryItem) {
    const url = `${location.origin}/d/${slug}#p-${item.id}`;
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ title: item.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      say("Link copied");
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") return;
      say("Could not share this picture");
    }
  }

  function reset() {
    store(defaultOrder);
    say("Back to the original order");
  }

  return (
    <div className={styles.gallery}>
      <div className={styles.galleryBar}>
        <p className={styles.galleryHint}>
          <span className={styles.hintMouse}>Drag pictures to arrange them</span>
          <span className={styles.hintTouch}>Hold a picture to move it</span>
          {starred.size > 0 && (
            <span className={styles.starCount}>
              <StarIcon on /> {starred.size} starred
            </span>
          )}
        </p>
        {arranged && (
          <button type="button" className={styles.resetOrder} onClick={reset}>
            Reset order
          </button>
        )}
      </div>
      <ul ref={list} className={styles.tiles} data-dragging={dragging ? "" : undefined} onPointerDown={onPointerDown}>
        {shown.map((id) => {
          const item = byId.get(id) as GalleryItem;
          const isStarred = starred.has(id);
          const live = item.href !== null;
          return (
            <li
              key={id}
              id={`p-${id}`}
              data-id={id}
              className={styles.tile}
              data-lifted={dragging === id ? "" : undefined}
              tabIndex={0}
              aria-label={item.name}
              aria-roledescription="movable picture"
              onKeyDown={(event) => onKeyDown(event, id)}
            >
              <figure className={styles.tileCard}>
                {/* eslint-disable-next-line @next/next/no-img-element -- a signed storage link, not a site asset */}
                <img
                  src={item.src}
                  alt={item.name}
                  loading={item.eager ? "eager" : "lazy"}
                  decoding="async"
                  fetchPriority={item.eager ? item.priority : undefined}
                  referrerPolicy="no-referrer"
                  draggable={false}
                />
                {item.badge}
                <figcaption className={styles.tools} data-starred={isStarred ? "" : undefined}>
                  <button
                    type="button"
                    className={styles.tool}
                    data-on={isStarred ? "" : undefined}
                    aria-pressed={isStarred}
                    aria-label={`Star ${item.name}`}
                    title={isStarred ? "Starred" : "Star"}
                    onClick={() => toggleStar(slug, id)}
                  >
                    <StarIcon on={isStarred} />
                  </button>
                  {canSave && item.save ? (
                    <SaveToPhone
                      targets={[item.save]}
                      label={`Save ${item.name} to your phone`}
                      disabled={!live}
                      className={styles.tool}
                      icon={<DownloadIcon />}
                    />
                  ) : live ? (
                    <a href={item.href as string} className={styles.tool} aria-label={`Download ${item.name}`} title="Download">
                      <DownloadIcon />
                    </a>
                  ) : (
                    <span className={`${styles.tool} ${styles.toolOff}`} aria-disabled="true" aria-label="Download">
                      <DownloadIcon />
                    </span>
                  )}
                  <button
                    type="button"
                    className={styles.tool}
                    aria-label={`Share ${item.name}`}
                    title="Share"
                    disabled={!live}
                    onClick={() => share(item)}
                  >
                    <ShareIcon />
                  </button>
                </figcaption>
              </figure>
            </li>
          );
        })}
      </ul>
      <div ref={ghost} className={styles.ghost} hidden={!dragging} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element -- a copy of the picture being moved */}
        <img alt="" referrerPolicy="no-referrer" draggable={false} />
      </div>
      <p className={styles.toast} role="status" data-show={toast ? "" : undefined}>
        {toast}
      </p>
    </div>
  );
}
