"use client";

// In-app invite scanner. Keeps joining inside the installed app: on iOS a Home Screen app doesn't share
// storage with Safari, so the system camera would open the link signed out. Uses the browser's own
// BarcodeDetector where it exists and lazily loads jsQR otherwise, so it costs nothing until opened.
// Only Kaban invite codes are accepted; any other QR content is ignored and never opened.
import { AnimatePresence, motion } from "motion/react";
import { Flashlight, FlashlightOff, ImageUp, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { HapticButton } from "./haptic-button";

const CODE = /^[A-HJ-NP-Z2-9]{10}$/;

/** The invite code inside scanned text (a bare code or a /family/join?code= link), else null. */
export function inviteFromScan(text: string): string | null {
  const raw = text.trim();
  const bare = raw.toUpperCase().replace(/[\s-]/g, "");
  if (CODE.test(bare)) return bare;
  try {
    const url = new URL(raw);
    if (!/^https?:$/.test(url.protocol) || url.pathname.replace(/\/$/, "") !== "/family/join") return null;
    const code = (url.searchParams.get("code") ?? "").toUpperCase();
    return CODE.test(code) ? code : null;
  } catch {
    return null;
  }
}

type Decoder = (source: CanvasImageSource, width: number, height: number) => Promise<string | null>;

interface DetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

let decoderPromise: Promise<Decoder> | undefined;

/** Native detector when it supports QR, otherwise jsQR on a downscaled canvas frame. */
function getDecoder(): Promise<Decoder> {
  decoderPromise ??= (async () => {
    const Native = (window as unknown as { BarcodeDetector?: { new (o: { formats: string[] }): DetectorLike; getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector;
    if (Native) {
      try {
        const formats = (await Native.getSupportedFormats?.()) ?? ["qr_code"];
        if (formats.includes("qr_code")) {
          const detector = new Native({ formats: ["qr_code"] });
          return async (source) => (await detector.detect(source))[0]?.rawValue ?? null;
        }
      } catch {
        /* fall through to jsQR */
      }
    }
    const { default: jsQR } = await import("jsqr");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    return async (source, width, height) => {
      // Decode the centre square (where the viewfinder is) at most 720px wide: fast and plenty sharp.
      const side = Math.min(width, height);
      const out = Math.min(720, side);
      canvas.width = canvas.height = out;
      ctx.drawImage(source, (width - side) / 2, (height - side) / 2, side, side, 0, 0, out, out);
      const image = ctx.getImageData(0, 0, out, out);
      return jsQR(image.data, out, out, { inversionAttempts: "attemptBoth" })?.data ?? null;
    };
  })();
  return decoderPromise;
}

/** Decode a QR from a still picture (a screenshot someone sent, or a photo). */
export async function decodeImageFile(file: File): Promise<string | null> {
  const bitmap = await createImageBitmap(file);
  try {
    return await (await getDecoder())(bitmap, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

type CameraState = "starting" | "live" | "denied" | "none" | "unsupported" | "error";

const noopSubscribe = () => () => {};

export function QrScanner({ open, onClose, onCode }: { open: boolean; onClose: () => void; onCode: (code: string) => void }) {
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!mounted) return null;
  return createPortal(<AnimatePresence>{open && <ScannerView onClose={onClose} onCode={onCode} />}</AnimatePresence>, document.body);
}

function ScannerView({ onClose, onCode }: { onClose: () => void; onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const track = useRef<MediaStreamTrack | null>(null);
  const done = useRef(false);
  const lastBad = useRef("");
  const [camera, setCamera] = useState<CameraState>("starting");
  const [torch, setTorch] = useState<boolean | null>(null);
  const [hint, setHint] = useState<string>();
  const file = useRef<HTMLInputElement>(null);
  const codeRef = useRef(onCode);
  useEffect(() => {
    codeRef.current = onCode;
  });

  function accept(text: string | null) {
    if (!text || done.current) return false;
    const code = inviteFromScan(text);
    if (code) {
      done.current = true;
      navigator.vibrate?.(30);
      codeRef.current(code);
      return true;
    }
    if (text !== lastBad.current) {
      lastBad.current = text;
      setHint("That isn't a Kaban family invite.");
    }
    return false;
  }

  useEffect(() => {
    let stream: MediaStream | undefined;
    let frame = 0;
    let stopped = false;
    let lastRun = 0;
    let busy = false;

    async function start() {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) return setCamera("unsupported");
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 1280 } } });
      } catch (e) {
        const name = (e as DOMException).name;
        return setCamera(name === "NotAllowedError" || name === "SecurityError" ? "denied" : name === "NotFoundError" || name === "OverconstrainedError" ? "none" : "error");
      }
      if (stopped) return stream.getTracks().forEach((t) => t.stop());
      const el = video.current!;
      el.srcObject = stream;
      await el.play().catch(() => {});
      track.current = stream.getVideoTracks()[0] ?? null;
      const caps = (track.current?.getCapabilities?.() ?? {}) as { torch?: boolean };
      setTorch(caps.torch ? false : null);
      setCamera("live");
      const decode = await getDecoder();
      const tick = (now: number) => {
        if (stopped || done.current) return;
        frame = requestAnimationFrame(tick);
        if (busy || now - lastRun < 120 || el.readyState < 2 || !el.videoWidth) return;
        lastRun = now;
        busy = true;
        decode(el, el.videoWidth, el.videoHeight)
          .then((text) => accept(text))
          .catch(() => {})
          .finally(() => (busy = false));
      };
      frame = requestAnimationFrame(tick);
    }
    void start();
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
      track.current = null;
    };
  }, []);

  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setHint(undefined), 2500);
    return () => clearTimeout(t);
  }, [hint]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function toggleTorch() {
    const next = !torch;
    try {
      await track.current?.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorch(next);
    } catch {
      setTorch(null);
    }
  }

  async function fromPhoto(f?: File) {
    if (!f) return;
    try {
      const text = await decodeImageFile(f);
      if (!text) setHint("No QR code found in that picture.");
      else accept(text);
    } catch {
      setHint("Couldn't read that picture.");
    }
  }

  const blocked = camera === "denied" || camera === "none" || camera === "unsupported" || camera === "error";
  const message = {
    denied: "Camera access is off for Kaban. Allow it in your browser or phone settings, or pick a screenshot of the code instead.",
    none: "No camera found on this device. Pick a screenshot of the code, or type it in.",
    unsupported: "This browser can't use the camera here. Pick a screenshot of the code, or type it in.",
    error: "The camera couldn't start. Close other apps using it and try again.",
  } as const;

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Scan family invite"
      className="fixed inset-0 z-[60] bg-black text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <video ref={video} playsInline muted autoPlay className="absolute inset-0 size-full object-cover" aria-hidden />

      {/* Dimmed surround with a rounded window in the middle. */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="relative aspect-square w-[min(72vw,20rem)] rounded-[2rem] shadow-[0_0_0_100vmax_rgb(0_0_0/0.55)]">
          {["top-0 left-0 border-t-4 border-l-4 rounded-tl-[2rem]", "top-0 right-0 border-t-4 border-r-4 rounded-tr-[2rem]", "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-[2rem]", "bottom-0 right-0 border-r-4 border-b-4 rounded-br-[2rem]"].map((c) => (
            <span key={c} className={`absolute size-12 border-mint ${c}`} />
          ))}
          {camera === "live" && <span className="scan-line absolute inset-x-6 top-6 h-0.5 rounded-full bg-mint/80 shadow-[0_0_12px_2px_rgb(159_233_194/0.6)]" />}
        </div>
      </div>

      <div className="pt-safe absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-3">
        <HapticButton type="button" onClick={onClose} aria-label="Close scanner" className="grid size-11 place-items-center rounded-full bg-black/45 backdrop-blur-sm">
          <X className="size-5" />
        </HapticButton>
        <p className="text-sm font-medium">Scan family invite</p>
        {torch !== null ? (
          <HapticButton type="button" onClick={toggleTorch} aria-label={torch ? "Turn off flashlight" : "Turn on flashlight"} aria-pressed={torch} className="grid size-11 place-items-center rounded-full bg-black/45 backdrop-blur-sm">
            {torch ? <FlashlightOff className="size-5" /> : <Flashlight className="size-5" />}
          </HapticButton>
        ) : (
          <span className="size-11" />
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 space-y-3 px-6 pb-[max(var(--safe-bottom),1.5rem)] text-center">
        <AnimatePresence mode="wait">
          {hint ? (
            <motion.p key="hint" role="status" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-auto w-fit rounded-full bg-expense px-4 py-2 text-sm font-medium text-on-expense">
              {hint}
            </motion.p>
          ) : blocked ? (
            <motion.p key="blocked" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-xs text-sm text-white/85">
              {message[camera]}
            </motion.p>
          ) : (
            <motion.p key="help" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-white/80">
              {camera === "starting" ? "Starting camera…" : "Point at the QR code on the other phone."}
            </motion.p>
          )}
        </AnimatePresence>
        <HapticButton type="button" onClick={() => file.current?.click()} className="mx-auto inline-flex min-h-11 items-center gap-2 rounded-full bg-white/15 px-4 text-sm font-medium backdrop-blur-sm">
          <ImageUp className="size-4" /> Use a screenshot
        </HapticButton>
        <input
          ref={file}
          type="file"
          accept="image/*"
          className="hidden"
          aria-label="Pick a picture of the invite code"
          onChange={(e) => {
            void fromPhoto(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
    </motion.div>
  );
}
