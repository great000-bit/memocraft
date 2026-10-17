import Link from "next/link";
import { FeatureIcon, type FeatureIconName } from "../FeatureIcons";
import { Avatar } from "../workspace/Avatar";
import { LocalTime } from "../deliveries/LocalTime";
import type { DayCount, FeedItem } from "@/lib/admin-data";
import { formatSize } from "@/lib/storage-limits";
import cards from "../workspace/Dashboard.module.css";
import styles from "./Admin.module.css";

export const plural = (count: number, one: string, many: string) => `${count.toLocaleString("en")} ${count === 1 ? one : many}`;
export const size = (bytes: number) => (bytes === 0 ? "0 MB" : formatSize(bytes));

const providerNames: Record<string, string> = { credential: "Password", google: "Google" };
export const providerName = (id: string) => providerNames[id] ?? id;

// Only rendered on the server, once per request, so reading the clock here is stable for that page.
const secondsSince = (date: Date) => Math.max(0, (Date.now() - date.getTime()) / 1000);

// "4 min ago" up to a week, then the date. Worked out on the server, so it is exact to the moment the page loaded.
export function Ago({ at }: { at: Date | string }) {
  const date = new Date(at);
  const seconds = secondsSince(date);
  if (seconds >= 7 * 86400) return <LocalTime iso={date.toISOString()} dateOnly />;
  const text =
    seconds < 60
      ? "just now"
      : seconds < 3600
        ? `${Math.floor(seconds / 60)} min ago`
        : seconds < 86400
          ? `${Math.floor(seconds / 3600)} h ago`
          : `${Math.floor(seconds / 86400)} d ago`;
  return (
    <time dateTime={date.toISOString()} title={date.toISOString()}>
      {text}
    </time>
  );
}

export function StatCard({
  label,
  icon,
  figure,
  unit,
  note,
  featured = false,
  children,
}: {
  label: string;
  icon: FeatureIconName;
  figure: React.ReactNode;
  unit?: React.ReactNode;
  note?: React.ReactNode;
  featured?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <article className={`${cards.card} ${featured ? cards.featured : ""}`}>
      <header className={cards.cardHead}>
        <span className={cards.bubble} aria-hidden="true">
          <FeatureIcon name={icon} />
        </span>
        <h2 className={cards.label}>{label}</h2>
      </header>
      <p className={cards.figure}>
        {figure}
        {unit && <span className={cards.unit}>{unit}</span>}
      </p>
      {children}
      {note && <p className={cards.note}>{note}</p>}
    </article>
  );
}

export function Meter({ used, limit, label }: { used: number; limit: number; label: string }) {
  const percent = Math.min(100, (used / limit) * 100);
  return (
    <div
      className={styles.meter}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
      aria-valuetext={`${size(used)} of ${formatSize(limit)}`}
      data-level={percent >= 90 ? "full" : percent >= 70 ? "high" : undefined}
    >
      <span style={{ width: `${used > 0 ? Math.max(percent, 3) : 0}%` }} />
    </div>
  );
}

const dayLabel = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", timeZone: "UTC" });

// Thirty bars, one per day. Each series stacks on the one before it, and every bar says its numbers on hover.
export function DayBars({
  title,
  days,
  series,
}: {
  title: string;
  days: DayCount[];
  series: { key: "signups" | "opens" | "downloads"; label: string; tone: "teal" | "amber" }[];
}) {
  const totals = days.map((day) => series.reduce((sum, s) => sum + day[s.key], 0));
  const max = Math.max(1, ...totals);
  const sums = series.map((s) => days.reduce((sum, day) => sum + day[s.key], 0));
  const summary = series.map((s, i) => `${sums[i]} ${s.label.toLowerCase()}`).join(", ");
  return (
    <section className={styles.panel} aria-label={title}>
      <header className={styles.panelHead}>
        <h2 className={styles.panelTitle}>{title}</h2>
        <ul className={styles.keys}>
          {series.map((s, i) => (
            <li key={s.key} data-tone={s.tone}>
              {s.label} <b>{sums[i]}</b>
            </li>
          ))}
        </ul>
      </header>
      <div className={styles.bars} role="img" aria-label={`Last 30 days: ${summary}`}>
        {days.map((day, i) => {
          const date = new Date(`${day.day}T00:00:00Z`);
          const tip = `${dayLabel.format(date)}: ${series.map((s) => `${day[s.key]} ${s.label.toLowerCase()}`).join(", ")}`;
          return (
            <span key={day.day} className={styles.bar} title={tip} data-empty={totals[i] === 0 || undefined}>
              <span className={styles.barStack} style={{ height: `${(totals[i] / max) * 100}%` }}>
                {series.map((s) =>
                  day[s.key] > 0 ? <span key={s.key} data-tone={s.tone} style={{ flexGrow: day[s.key] }} /> : null,
                )}
              </span>
            </span>
          );
        })}
      </div>
      <div className={styles.barAxis} aria-hidden="true">
        <span>{dayLabel.format(new Date(`${days[0]?.day}T00:00:00Z`))}</span>
        <span>Today</span>
      </div>
    </section>
  );
}

const feedIcon: Record<FeedItem["kind"], FeatureIconName> = {
  signup: "profile",
  published: "upload",
  open: "proof",
  download: "file",
  request: "request",
};

function quote(text: string | null) {
  return text ? `“${text}”` : "a delivery";
}

function FeedText({ item }: { item: FeedItem }) {
  const who = <b>{item.userName ?? "Deleted account"}</b>;
  const client = item.clientName ? <b>{item.clientName}</b> : "A client";
  switch (item.kind) {
    case "signup":
      return <>{who} signed up</>;
    case "published":
      return (
        <>
          {who} published {quote(item.deliveryTitle)}
          {item.clientName && <> for {item.clientName}</>}
        </>
      );
    case "open":
      return (
        <>
          {client} opened {quote(item.deliveryTitle)} from {who}
        </>
      );
    case "download":
      return (
        <>
          {client} downloaded {item.fileName ? <b>{item.fileName}</b> : "a file"} from {who}
        </>
      );
    case "request":
      return (
        <>
          {client} asked {who} for {item.fileName ? <b>{item.fileName}</b> : "something"} on {quote(item.deliveryTitle)}
        </>
      );
  }
}

export function Feed({ items, empty = "Nothing has happened yet." }: { items: FeedItem[]; empty?: string }) {
  if (items.length === 0) return <p className={styles.emptyLine}>{empty}</p>;
  return (
    <ol className={styles.feed}>
      {items.map((item, i) => (
        <li key={`${item.kind}-${new Date(item.at).getTime()}-${i}`} className={styles.feedItem} data-kind={item.kind}>
          <span className={styles.feedIcon} aria-hidden="true">
            <FeatureIcon name={feedIcon[item.kind]} />
          </span>
          <span className={styles.feedText}>
            {item.userId ? (
              <Link href={`/admin/users/${item.userId}`} prefetch={false} className={styles.feedLink}>
                <FeedText item={item} />
              </Link>
            ) : (
              <FeedText item={item} />
            )}
            {item.device && <span className={styles.feedMeta}>{item.device}</span>}
          </span>
          <span className={styles.feedTime}>
            <Ago at={item.at} />
          </span>
        </li>
      ))}
    </ol>
  );
}

export function UserChip({ id, name, email, image }: { id: string; name: string; email: string; image: string | null }) {
  return (
    <Link href={`/admin/users/${id}`} prefetch={false} className={styles.userChip}>
      <Avatar name={name} image={image} size={36} />
      <span className={styles.userChipText}>
        <span className={styles.userChipName}>{name}</span>
        <span className={styles.userChipEmail}>{email}</span>
      </span>
    </Link>
  );
}

export function PanelSkeleton({ height = 220 }: { height?: number }) {
  return <div className={`${styles.panel} ${cards.skeleton}`} style={{ minHeight: height }} aria-hidden="true" />;
}
