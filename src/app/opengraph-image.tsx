import { ImageResponse } from "next/og";

// The picture shown when a Memocraft link is shared: on WhatsApp, iMessage, Slack, LinkedIn and X.
export const alt = "Memocraft: did they get the files? Now you’ll know.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "radial-gradient(900px 520px at 85% 100%, rgba(63,190,168,0.32), rgba(26,31,30,0) 70%), #1a1f1e",
          color: "#e6eae8",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>
          <span style={{ color: "#e8a33d" }}>em</span>
          <span style={{ marginLeft: 14 }}>Memocraft</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 92, fontWeight: 700, letterSpacing: -3, lineHeight: 1.02 }}>
            Did they get the files?
          </div>
          <div style={{ display: "flex", fontSize: 92, fontWeight: 700, letterSpacing: -3, lineHeight: 1.02, color: "#5fcfbb" }}>
            Now you&rsquo;ll know.
          </div>
          <div style={{ display: "flex", marginTop: 28, fontSize: 32, color: "#a9b3ae" }}>
            One link for every delivery, with proof they opened and saved it.
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#8d9792" }}>www.memocraft.space</div>
      </div>
    ),
    { ...size },
  );
}
