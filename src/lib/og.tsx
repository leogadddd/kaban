import { ImageResponse } from "next/og";
import { LogoMark } from "./logo";
import { SITE_TAGLINE } from "./site";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_ALT = `Kaban: ${SITE_TAGLINE}`;

/** Social share card: headline on the left, stacked account cards on the right. */
export function renderOgImage() {
  const cards = [
    { c: "#1F2D27", label: "Credit Card", v: "₱47,940.50", top: 0, rot: -7 },
    { c: "#176B4D", label: "Savings", v: "₱139,851.00", top: 92, rot: 4 },
    { c: "#2D936C", label: "Wallet", v: "₱6,895.00", top: 184, rot: -2 },
  ];
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#F7FAF7", padding: "64px 72px", position: "relative" }}>
        <div style={{ position: "absolute", right: -120, top: -160, width: 620, height: 620, borderRadius: 9999, background: "#CFE8D8", opacity: 0.7, display: "flex" }} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 600 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <LogoMark size={64} />
            <span style={{ fontSize: 40, fontWeight: 700, color: "#17241D", letterSpacing: -1 }}>Kaban</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 68, fontWeight: 700, color: "#17241D", lineHeight: 1.02, letterSpacing: -2.5 }}>Every peso,</div>
            <div style={{ fontSize: 68, fontWeight: 700, color: "#2D936C", lineHeight: 1.02, letterSpacing: -2.5 }}>accounted for.</div>
            <div style={{ marginTop: 24, fontSize: 28, color: "#4C5C53", lineHeight: 1.3 }}>Cash, banks, e-wallets &amp; credit cards · instalments · who owes you</div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {["Free", "Works offline", "Installs on iPhone"].map((t) => (
              <div key={t} style={{ display: "flex", padding: "10px 20px", borderRadius: 999, background: "#E8F4EC", color: "#176B4D", fontSize: 22, fontWeight: 600 }}>
                {t}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", position: "relative", flex: 1, marginLeft: 40, marginTop: 40 }}>
          {cards.map((k) => (
            <div
              key={k.label}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: k.top,
                height: 190,
                borderRadius: 34,
                background: k.c,
                transform: `rotate(${k.rot}deg)`,
                boxShadow: "0 24px 48px -16px rgba(15,61,46,0.5)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                padding: "26px 30px",
                color: "white",
              }}
            >
              <span style={{ fontSize: 24, opacity: 0.75 }}>{k.label}</span>
              <span style={{ fontSize: 46, fontWeight: 700, letterSpacing: -1.5 }}>{k.v}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
