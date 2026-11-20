"use client";

import { useEffect, useRef, useState } from "react";
import { Mascot, type MascotAction } from "./mascot";

/**
 * The mascot beside Available funds: peeks out on arrival, idles, drops a coin in when the balance rises,
 * lets one out when it falls, celebrates on tap, and stays locked while amounts are hidden.
 */
export function KabanChest({ amount, hidden, className }: { amount: number; hidden: boolean; className?: string }) {
  const [act, setAct] = useState<{ action: MascotAction; key: number }>({ action: "peek", key: 0 });
  const prev = useRef(amount);

  useEffect(() => {
    if (prev.current === amount) return;
    const action = amount > prev.current ? "coin-in" : "coin-out";
    prev.current = amount;
    setAct((a) => ({ action, key: a.key + 1 }));
  }, [amount]);

  const action: MascotAction = hidden
    ? act.action === "nope" ? "nope" : "locked"
    : act.action === "nope" || act.action === "locked" ? "idle" : act.action;

  return (
    <button
      type="button"
      aria-label={hidden ? "Kaban chest, locked" : "Kaban chest"}
      onClick={() => {
        navigator.vibrate?.(hidden ? 6 : [8, 30, 12]);
        setAct((a) => ({ action: hidden ? "nope" : "celebrate", key: a.key + 1 }));
      }}
      className={`relative shrink-0 touch-manipulation select-none outline-none [-webkit-tap-highlight-color:transparent] ${className ?? ""}`}
    >
      <Mascot action={action} playKey={act.key} onDone={() => setAct((a) => ({ action: "idle", key: a.key }))} className="block h-full w-full" />
    </button>
  );
}
