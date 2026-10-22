// Upload limits live apart from the storage client so the browser can read them too.
// The account and file caps are placeholders until pricing is decided; they also bound what testing can cost.
const MB = 1024 * 1024;
const GB = 1024 * MB;

export const storageLimits = {
  maxFileBytes: 2 * GB,
  accountBytes: 100 * GB,
  // At or below this size a file goes up in one request; above it, in parts that can each be retried.
  singleUploadMaxBytes: 64 * MB,
  minPartBytes: 16 * MB,
  maxParts: 10_000,
  // A thumbnail is a small JPEG made in the browser; anything bigger is refused.
  thumbMaxBytes: 256 * 1024,
} as const;

export function partSizeFor(size: number): number {
  return Math.max(storageLimits.minPartBytes, Math.ceil(size / storageLimits.maxParts));
}

export function formatSize(bytes: number): string {
  if (bytes < MB) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < GB) return `${(bytes / MB).toFixed(bytes < 10 * MB ? 1 : 0)} MB`;
  return `${(bytes / GB).toFixed(1)} GB`;
}
