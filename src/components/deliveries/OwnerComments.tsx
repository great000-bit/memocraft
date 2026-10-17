"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { limits } from "@/lib/delivery-limits";
import { replyToComment, setCommentResolved } from "@/lib/feedback-actions";
import type { CommentView } from "./ClientFeedback";
import { LocalTime } from "./LocalTime";
import styles from "./OwnerFeedback.module.css";

// One file's comments in the editor: the picture with numbered pins, each note, a reply box and "Done".
export function OwnerComments({ fileName, thumb, comments }: { fileName: string; thumb: string | null; comments: CommentView[] }) {
  const pinned = comments.filter((comment) => !comment.fromOwner && comment.x !== null && comment.y !== null);
  const roots = comments.filter((comment) => !comment.fromOwner);
  return (
    <article className={styles.file}>
      <h4 className={styles.fileName}>{fileName}</h4>
      <div className={styles.fileBody}>
        {thumb && pinned.length > 0 && (
          <div className={styles.canvas}>
            {/* eslint-disable-next-line @next/next/no-img-element -- a signed storage link, not a site asset */}
            <img src={thumb} alt="" />
            {pinned.map((comment, index) => (
              <span
                key={comment.id}
                className={styles.pin}
                data-resolved={comment.resolved || undefined}
                style={{ left: `${comment.x! * 100}%`, top: `${comment.y! * 100}%` }}
              >
                {index + 1}
              </span>
            ))}
          </div>
        )}
        <ol className={styles.notes}>
          {roots.map((comment) => (
            <Note
              key={comment.id}
              comment={comment}
              number={pinned.indexOf(comment)}
              replies={comments.filter((reply) => reply.parentId === comment.id)}
            />
          ))}
        </ol>
      </div>
    </article>
  );
}

function Note({ comment, number, replies }: { comment: CommentView; number: number; replies: CommentView[] }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run(task: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await task();
        if (result.ok) router.refresh();
        else setError(result.error ?? "Could not save that.");
      } catch {
        setError("Could not save that. Try again.");
      }
    });
  }

  return (
    <li className={styles.note} data-resolved={comment.resolved || undefined}>
      <p className={styles.noteHead}>
        {number >= 0 && <span className={styles.noteNumber}>{number + 1}</span>}
        <b>{comment.name || "Your client"}</b>
        <LocalTime iso={comment.at} />
        {comment.resolved && <span className={styles.done}>Done</span>}
      </p>
      <p className={styles.noteText}>{comment.message}</p>
      {replies.map((reply) => (
        <p key={reply.id} className={styles.reply}>
          <b>You</b> {reply.message}
        </p>
      ))}
      <form
        className={styles.replyForm}
        onSubmit={(event) => {
          event.preventDefault();
          run(async () => {
            const result = await replyToComment(comment.id, text);
            if (result.ok) setText("");
            return result;
          });
        }}
      >
        <input
          value={text}
          maxLength={limits.comment}
          onChange={(event) => setText(event.target.value)}
          placeholder="Reply to your client"
          aria-label={`Reply to ${comment.name || "your client"}`}
        />
        <button type="submit" className={styles.replyButton} disabled={pending || !text.trim()}>
          Reply
        </button>
        <button
          type="button"
          className={styles.doneButton}
          disabled={pending}
          onClick={() => run(() => setCommentResolved(comment.id, !comment.resolved))}
        >
          {comment.resolved ? "Open again" : "Mark done"}
        </button>
      </form>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </li>
  );
}
