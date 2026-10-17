"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { limits } from "@/lib/delivery-limits";
import { addComment, approve, setFavourite } from "@/lib/feedback-actions";
import { FeatureIcon } from "../FeatureIcons";
import { LocalTime } from "./LocalTime";
import styles from "./Feedback.module.css";

// What a client can say back on the delivery page: a heart, a comment pinned to a spot on a picture, and Approve.
// Nothing asks who they are. The browser keeps a random id, its hearts and the name it typed, so a heart can be
// taken back and the name is filled in next time.

export type CommentView = {
  id: string;
  message: string;
  x: number | null;
  y: number | null;
  name: string | null;
  fromOwner: boolean;
  parentId: string | null;
  at: string;
  resolved: boolean;
};

export type ApprovalView = { at: string; name: string | null } | null;

const keyName = "mc-client";
const nameKey = "mc-client-name";
const heartsKey = (slug: string) => `mc-hearts:${slug}`;
const heartsEvent = "mc-hearts";

function read(key: string): string | null {
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
    // Private windows can refuse storage; the heart still counts, it just will not show as yours after a reload.
  }
}

// Made once per browser. Without storage a new one is made per page load, which is still enough to count once.
let memoryKey: string | null = null;
function clientKey(): string {
  const stored = read(keyName);
  if (stored && /^[A-Za-z0-9-]{8,64}$/.test(stored)) return stored;
  if (!memoryKey) {
    try {
      memoryKey = crypto.randomUUID();
    } catch {
      memoryKey = `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
    }
  }
  write(keyName, memoryKey);
  return memoryKey;
}

function readHearts(slug: string): string[] {
  try {
    const list = JSON.parse(read(heartsKey(slug)) ?? "[]");
    return Array.isArray(list) ? list.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

const subscribeHearts = (callback: () => void) => {
  window.addEventListener(heartsEvent, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(heartsEvent, callback);
    window.removeEventListener("storage", callback);
  };
};

function useHeart(slug: string, fileId: string): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(
    subscribeHearts,
    () => readHearts(slug).includes(fileId),
    () => false,
  );
  const set = (value: boolean) => {
    const list = readHearts(slug).filter((id) => id !== fileId);
    write(heartsKey(slug), JSON.stringify(value ? [...list, fileId] : list));
    window.dispatchEvent(new Event(heartsEvent));
  };
  return [on, set];
}

function useSavedName(fallback: string | null): [string, (value: string) => void] {
  const [name, setName] = useState(fallback ?? "");
  useEffect(() => {
    const saved = read(nameKey);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- storage is only readable after hydration
    if (saved) setName(saved);
  }, []);
  return [
    name,
    (value: string) => {
      setName(value);
      write(nameKey, value);
    },
  ];
}

export function Heart({ slug, fileId, fileName, overlay = false }: { slug: string; fileId: string; fileName: string; overlay?: boolean }) {
  const [on, setOn] = useHeart(slug, fileId);
  const [, startTransition] = useTransition();
  return (
    <button
      type="button"
      className={overlay ? `${styles.heart} ${styles.heartOverlay}` : styles.heart}
      aria-pressed={on}
      aria-label={on ? `Remove heart from ${fileName}` : `Heart ${fileName}`}
      onClick={() => {
        const next = !on;
        setOn(next);
        startTransition(async () => {
          try {
            const result = await setFavourite(slug, clientKey(), fileId, next);
            if (!result.ok) setOn(!next);
          } catch {
            setOn(!next);
          }
        });
      }}
    >
      <FeatureIcon name="heart" />
    </button>
  );
}

// Approving takes two taps, so a stray thumb on a phone never sends a receipt by mistake.
function ApproveButton({
  slug,
  fileId,
  fileName,
  approval,
  compact,
}: {
  slug: string;
  fileId: string;
  fileName: string;
  approval: ApprovalView;
  compact: boolean;
}) {
  const [asking, setAsking] = useState(false);
  const [done, setDone] = useState<ApprovalView>(approval);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Only a name this browser typed itself goes on a one-tap receipt, never the one the creative filled in.
  const [name] = useSavedName(null);
  const router = useRouter();
  const shown = done ?? approval;

  if (shown) return <ApprovedChip approval={shown} compact={compact} />;
  if (!asking) {
    return (
      <button type="button" className={styles.approve} onClick={() => setAsking(true)}>
        Approve
        <span className={styles.srOnly}> {fileName}</span>
      </button>
    );
  }
  return (
    <span className={styles.confirm} data-compact={compact || undefined}>
      <button
        type="button"
        className={styles.approveYes}
        disabled={pending}
        aria-label={`Yes, approve ${fileName}`}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            try {
              const result = await approve(slug, clientKey(), fileId, name);
              if (result.ok) {
                setDone({ at: result.at ?? new Date().toISOString(), name: name || null });
                router.refresh();
              } else setError(result.error);
            } catch {
              setError("Could not send. Try again.");
            }
          })
        }
      >
        {pending ? "Approving…" : "Yes, approve"}
      </button>
      <button type="button" className={styles.cancel} onClick={() => setAsking(false)}>
        Cancel
      </button>
      {error && (
        <span className={styles.error} role="alert">
          {error}
        </span>
      )}
    </span>
  );
}

// On a picture tile there is only room for the word; the date is in the tooltip and on the creative's receipt.
function ApprovedChip({ approval, compact }: { approval: NonNullable<ApprovalView>; compact: boolean }) {
  return (
    <span className={styles.approved} title={compact ? `Approved ${new Date(approval.at).toLocaleString()}` : undefined}>
      <FeatureIcon name="proof" />
      Approved
      {!compact && (
        <>
          {" "}
          <LocalTime iso={approval.at} dateOnly />
        </>
      )}
    </span>
  );
}

// The bar under each file on the client page. "interactive" is false in the owner's preview, which shows the same
// approvals and comments without the buttons that would send anything.
export function FileFeedback({
  slug,
  fileId,
  fileName,
  picture,
  approval,
  comments,
  interactive,
  defaultName,
  compact = false,
}: {
  slug: string;
  fileId: string;
  fileName: string;
  picture: string | null;
  approval: ApprovalView;
  comments: CommentView[];
  interactive: boolean;
  defaultName: string | null;
  // On a picture tile: the heart sits on the picture, and the comment button is just its icon.
  compact?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const count = comments.length;
  if (!interactive && !approval && count === 0) return null;
  return (
    <div className={styles.bar} data-compact={compact || undefined}>
      {interactive && !compact && <Heart slug={slug} fileId={fileId} fileName={fileName} />}
      {(interactive || count > 0) && (
        <button
          type="button"
          className={styles.commentButton}
          data-compact={compact || undefined}
          onClick={() => {
            setOpen(true);
            dialog.current?.showModal();
          }}
        >
          <FeatureIcon name="comment" />
          {count > 0 ? <span>{count}</span> : !compact && <span>Comment</span>}
          <span className={styles.srOnly}> on {fileName}</span>
        </button>
      )}
      {interactive ? (
        <ApproveButton slug={slug} fileId={fileId} fileName={fileName} approval={approval} compact={compact} />
      ) : (
        approval && <ApprovedChip approval={approval} compact={compact} />
      )}
      <dialog
        ref={dialog}
        className={styles.sheet}
        aria-label={`Comments on ${fileName}`}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current.close();
        }}
      >
        {open && (
          <CommentSheet
            slug={slug}
            fileId={fileId}
            fileName={fileName}
            picture={picture}
            comments={comments}
            interactive={interactive}
            defaultName={defaultName}
            close={() => dialog.current?.close()}
          />
        )}
      </dialog>
    </div>
  );
}

function CommentSheet({
  slug,
  fileId,
  fileName,
  picture,
  comments,
  interactive,
  defaultName,
  close,
}: {
  slug: string;
  fileId: string;
  fileName: string;
  picture: string | null;
  comments: CommentView[];
  interactive: boolean;
  defaultName: string | null;
  close: () => void;
}) {
  const [pin, setPin] = useState<{ x: number; y: number } | null>(null);
  const [message, setMessage] = useState("");
  const [name, setName] = useSavedName(defaultName);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const box = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  // Client notes are numbered; the creative's replies sit under the note they answer, at the same spot.
  const pinned = comments.filter((comment) => !comment.fromOwner && comment.x !== null && comment.y !== null);

  function place(event: React.MouseEvent<HTMLDivElement>) {
    if (!interactive) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setPin({
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    });
    box.current?.focus({ preventScroll: true });
  }

  function send(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const result = await addComment(slug, clientKey(), fileId, { message, x: pin?.x ?? null, y: pin?.y ?? null, name });
        if (result.ok) {
          setMessage("");
          setPin(null);
          router.refresh();
        } else setError(result.error);
      } catch {
        setError("Could not send this. Check your connection and try again.");
      }
    });
  }

  return (
    <div className={styles.sheetBody}>
      <div className={styles.sheetHead}>
        <h2 className={styles.sheetTitle}>{fileName}</h2>
        <button type="button" className={styles.close} onClick={close} aria-label="Close">
          ×
        </button>
      </div>
      {picture && (
        <div className={styles.stage}>
          <div className={styles.canvas} onClick={place} data-interactive={interactive || undefined}>
            {/* eslint-disable-next-line @next/next/no-img-element -- a signed storage link, not a site asset */}
            <img src={picture} alt={fileName} draggable={false} />
            {pinned.map((comment, index) => (
              <span
                key={comment.id}
                className={styles.pin}
                data-resolved={comment.resolved || undefined}
                style={{ left: `${comment.x! * 100}%`, top: `${comment.y! * 100}%` }}
                aria-hidden="true"
              >
                {index + 1}
              </span>
            ))}
            {pin && (
              <span className={`${styles.pin} ${styles.pinNew}`} style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }} aria-hidden="true">
                +
              </span>
            )}
          </div>
          {interactive && <p className={styles.hint}>{pin ? "Pinned. Say what to change there." : "Tap the picture to pin your note to a spot."}</p>}
        </div>
      )}

      {comments.length > 0 ? (
        <ol className={styles.thread}>
          {threaded(comments).map((comment) => {
            const number = pinned.indexOf(comment);
            return (
              <li key={comment.id} className={styles.note} data-owner={comment.fromOwner || undefined} data-resolved={comment.resolved || undefined}>
                <p className={styles.noteHead}>
                  {number >= 0 && <span className={styles.noteNumber}>{number + 1}</span>}
                  <b>{comment.fromOwner ? "Reply" : comment.name || "Client"}</b>
                  <span>
                    <LocalTime iso={comment.at} />
                  </span>
                  {comment.resolved && <span className={styles.done}>Done</span>}
                </p>
                <p className={styles.noteText}>{comment.message}</p>
              </li>
            );
          })}
        </ol>
      ) : (
        !interactive && <p className={styles.hint}>No comments.</p>
      )}

      {interactive && (
        <form className={styles.form} onSubmit={send}>
          <label className={styles.field}>
            <span>Your comment</span>
            <textarea
              ref={box}
              rows={3}
              value={message}
              maxLength={limits.comment}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="For example: can the logo be a little bigger here?"
              required
            />
          </label>
          <label className={styles.field}>
            <span>Your name (optional)</span>
            <input value={name} maxLength={limits.clientName} autoComplete="name" onChange={(event) => setName(event.target.value)} />
          </label>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <button type="submit" className={styles.send} disabled={pending || message.trim().length < 2}>
            {pending ? "Sending…" : "Send comment"}
          </button>
        </form>
      )}
    </div>
  );
}

// Each client note followed by the creative's replies to it.
function threaded(comments: CommentView[]): CommentView[] {
  return comments
    .filter((comment) => !comment.parentId)
    .flatMap((comment) => [comment, ...comments.filter((reply) => reply.parentId === comment.id)]);
}

// "Happy with everything?" at the end of the page. The receipt it makes covers every file on the page right now.
export function ApproveAll({
  slug,
  senderName,
  approval,
  fileCount,
  interactive,
  defaultName,
}: {
  slug: string;
  senderName: string;
  approval: ApprovalView;
  fileCount: number;
  interactive: boolean;
  defaultName: string | null;
}) {
  const [name, setName] = useSavedName(defaultName);
  const [done, setDone] = useState<ApprovalView>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const shown = done ?? approval;
  if (fileCount === 0 || (!interactive && !shown)) return null;

  return (
    <section className={styles.all} aria-labelledby="approve-all-title" data-done={shown ? true : undefined}>
      {shown ? (
        <div className={styles.receipt} role="status">
          <span className={styles.receiptMark} aria-hidden="true">
            <FeatureIcon name="proof" />
          </span>
          <div>
            <h2 id="approve-all-title" className={styles.allTitle}>
              Approved
            </h2>
            <p className={styles.allText}>
              {shown.name ? `${shown.name} approved` : "Approved"} all {fileCount} {fileCount === 1 ? "file" : "files"} on{" "}
              <LocalTime iso={shown.at} />. {senderName} has a dated record of it.
            </p>
          </div>
        </div>
      ) : (
        <form
          className={styles.allForm}
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            startTransition(async () => {
              try {
                const result = await approve(slug, clientKey(), null, name);
                if (result.ok) {
                  setDone({ at: result.at ?? new Date().toISOString(), name: name || null });
                  router.refresh();
                } else setError(result.error);
              } catch {
                setError("Could not send. Check your connection and try again.");
              }
            });
          }}
        >
          <h2 id="approve-all-title" className={styles.allTitle}>
            Happy with everything?
          </h2>
          <p className={styles.allText}>
            Approve all {fileCount} {fileCount === 1 ? "file" : "files"} and {senderName} gets a dated record that you signed off.
          </p>
          <label className={styles.field}>
            <span>Your name (optional)</span>
            <input value={name} maxLength={limits.clientName} autoComplete="name" onChange={(event) => setName(event.target.value)} />
          </label>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <button type="submit" className={styles.send} disabled={pending}>
            {pending ? "Approving…" : "Approve all files"}
          </button>
        </form>
      )}
    </section>
  );
}
