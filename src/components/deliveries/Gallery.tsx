"use client";

import { useLayoutEffect, useRef } from "react";
import styles from "./ClientView.module.css";

const rowHeight = 4;

// The pictures as a masonry: each keeps its own shape and the order still reads left to right, row by row. Every
// picture spans as many thin grid rows as it is tall, measured again whenever it changes (a picture arriving, text
// wrapping, the window resizing). Until this runs, and without scripts, the same list is a plain grid.
export function Gallery({ children }: { children: React.ReactNode }) {
  const list = useRef<HTMLUListElement>(null);

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
  }, []);

  return (
    <ul ref={list} className={styles.tiles}>
      {children}
    </ul>
  );
}
