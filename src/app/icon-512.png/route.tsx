import { ImageResponse } from "next/og";
import { LogoMark } from "@/lib/logo";

export function GET() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#176B4D" }}>
        <LogoMark size={512} bg="square" />
      </div>
    ),
    { width: 512, height: 512 },
  );
}
