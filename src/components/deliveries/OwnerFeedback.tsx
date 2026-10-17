import type { Feedback } from "@/lib/feedback";
import { formatSize } from "@/lib/storage-limits";
import { FeatureIcon } from "../FeatureIcons";
import { LocalTime } from "./LocalTime";
import { OwnerComments } from "./OwnerComments";
import activity from "./Activity.module.css";
import styles from "./OwnerFeedback.module.css";

type FileInfo = { id: string; name: string; thumb: string | null };

// What the client said back, for the creative: every approval as a dated receipt, hearts, and comments to answer.
export function FeedbackPanel({ feedback, files }: { feedback: Feedback; files: FileInfo[] }) {
  const hearts = Object.values(feedback.favourites).reduce((sum, n) => sum + n, 0);
  const open = feedback.comments.filter((comment) => !comment.fromOwner && !comment.resolved).length;
  const whole = feedback.approvals.find((approval) => approval.fileId === null && approval.current);
  const approvedFiles = new Set(feedback.approvals.filter((approval) => approval.current && approval.fileId).map((approval) => approval.fileId));
  const badge = whole
    ? { text: "Approved", state: "downloaded" }
    : approvedFiles.size > 0
      ? { text: `${approvedFiles.size} of ${files.length} approved`, state: "opened" }
      : { text: "Waiting for approval", state: "waiting" };
  const withComments = files.filter((file) => feedback.comments.some((comment) => comment.fileId === file.id));
  const nothing = feedback.approvals.length === 0 && hearts === 0 && feedback.comments.length === 0;

  return (
    <section id="feedback" className={`${activity.panel} ${styles.panel}`} aria-labelledby="feedback-title">
      <div className={activity.head}>
        <h2 id="feedback-title" className={activity.title}>
          Client feedback
        </h2>
        <span className={activity.badge} data-state={badge.state}>
          {badge.text}
        </span>
      </div>

      {nothing ? (
        <p className={activity.empty}>
          Your client can heart files, pin comments on pictures and approve each file or everything at once. It shows up here
          with the time, and every approval is kept as a receipt.
        </p>
      ) : (
        <>
          <dl className={activity.stats}>
            <div className={activity.stat}>
              <dt>Approvals</dt>
              <dd>{feedback.approvals.length}</dd>
            </div>
            <div className={activity.stat}>
              <dt>Hearts</dt>
              <dd>{hearts}</dd>
            </div>
            <div className={activity.stat}>
              <dt>Comments to answer</dt>
              <dd>{open}</dd>
            </div>
          </dl>

          {feedback.approvals.length > 0 && (
            <div className={styles.block}>
              <h3 className={styles.blockTitle}>Receipts</h3>
              <ul className={styles.receipts}>
                {feedback.approvals.map((approval) => (
                  <li key={approval.id} className={styles.receipt} data-current={approval.current || undefined}>
                    <span className={styles.receiptIcon} aria-hidden="true">
                      <FeatureIcon name="approve" />
                    </span>
                    <span className={styles.receiptText}>
                      <b>
                        {approval.name ?? "Your client"} approved {approval.fileId ? (approval.fileName ?? "a file") : "all files"}
                      </b>
                      <span>
                        <LocalTime iso={approval.at.toISOString()} /> · {approval.device}
                        {approval.fileSize ? ` · ${formatSize(approval.fileSize)}` : ""}
                        {!approval.current && " · for an earlier version"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {files.some((file) => feedback.favourites[file.id]) && (
            <div className={styles.block}>
              <h3 className={styles.blockTitle}>Hearted</h3>
              <ul className={styles.hearts}>
                {files
                  .filter((file) => feedback.favourites[file.id])
                  .sort((a, b) => feedback.favourites[b.id] - feedback.favourites[a.id])
                  .map((file) => (
                    <li key={file.id} className={styles.heartItem}>
                      {file.thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element -- a signed storage link, not a site asset
                        <img src={file.thumb} alt="" />
                      ) : (
                        <span className={styles.heartFile} aria-hidden="true">
                          <FeatureIcon name="file" />
                        </span>
                      )}
                      <span className={styles.heartName}>{file.name}</span>
                      <span className={styles.heartCount}>
                        <FeatureIcon name="heart" />
                        {feedback.favourites[file.id]}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {withComments.length > 0 && (
            <div className={styles.block}>
              <h3 className={styles.blockTitle}>Comments</h3>
              {withComments.map((file) => (
                <OwnerComments
                  key={file.id}
                  fileName={file.name}
                  thumb={file.thumb}
                  comments={feedback.comments
                    .filter((comment) => comment.fileId === file.id)
                    .map((comment) => ({
                      id: comment.id,
                      message: comment.message,
                      x: comment.x,
                      y: comment.y,
                      name: comment.name,
                      fromOwner: comment.fromOwner,
                      parentId: comment.parentId,
                      at: comment.createdAt.toISOString(),
                      resolved: comment.resolved,
                    }))}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
