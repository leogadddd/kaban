import { ImageResponse } from "next/og";
import { LogoMark } from "@/lib/logo";

export function GET() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#176B4D" }}>
        <LogoMark size={Math.round(192 * 0.8)} bg={false} />
      </div>
    ),
    { width: 192, height: 192 },
  );
}
