/* eslint-disable @next/next/no-img-element -- tiny bundled PNGs; next/image adds nothing offline */
import type { Bank } from "@/lib/banks";
import { cx } from "./ui";

/** Bank mark: the bundled logo on a white tile, or a brand-colour badge when there's no usable file. */
export function BankLogo({ bank, size = 40, className }: { bank: Bank; size?: number; className?: string }) {
  const radius = Math.round(size * 0.28);
  if (bank.logo)
    return (
      <span
        className={cx("grid shrink-0 place-items-center overflow-hidden bg-white ring-1 ring-black/5", className)}
        style={{ width: size, height: size, borderRadius: radius }}
      >
        <img src={bank.logo} alt={bank.name} width={size} height={size} className="size-full object-contain" draggable={false} />
      </span>
    );
  const label = bank.badge ?? bank.short;
  const text = label.length > 4 ? label.slice(0, 4) : label;
  return (
    <span
      role="img"
      aria-label={bank.name}
      className={cx("grid shrink-0 place-items-center font-bold tracking-tight", className)}
      style={{ width: size, height: size, borderRadius: radius, background: bank.color, color: bank.ink ?? "#fff", fontSize: size * (text.length > 3 ? 0.28 : 0.34) }}
    >
      {text}
    </span>
  );
}
