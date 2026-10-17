import { Button } from "@/components/Button";

export default function DeliveryUnavailable() {
  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "96px 16px", display: "grid", gap: 12 }}>
      <h1 style={{ fontSize: 32, lineHeight: 1.15 }}>This link is not available</h1>
      <p style={{ fontSize: 18, lineHeight: "28px", color: "var(--text-muted)" }}>
        The sender may have switched it off, or the address was copied incompletely. Ask them to send it again.
      </p>
      <div style={{ marginTop: 12 }}>
        <Button href="/" variant="outline">
          About Memocraft
        </Button>
      </div>
    </main>
  );
}
