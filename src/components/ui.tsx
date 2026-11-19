"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, X } from "lucide-react";
import { useEffect, useId, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { formatMoney } from "@/lib/money";
import { useMoney } from "@/lib/privacy";
import { animatedBack } from "@/lib/nav-direction";

const noopSubscribe = () => () => {};

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Money({
  minor,
  className,
  sign,
  compact,
  tone,
}: {
  minor: number;
  className?: string;
  sign?: boolean;
  compact?: boolean;
  tone?: "auto" | "expense" | "income";
}) {
  const color =
    tone === "expense" ? "text-expense" : tone === "income" ? "text-income" : tone === "auto" ? (minor < 0 ? "text-expense" : minor > 0 ? "text-income" : "") : "";
  return <MoneyText minor={minor} sign={sign} compact={compact} className={cx("num amount", color, className)} />;
}

function MoneyText({ minor, sign, compact, className }: { minor: number; sign?: boolean; compact?: boolean; className?: string }) {
  const { fmt, hidden } = useMoney();
  return (
    <span className={className} aria-label={hidden ? "Amount hidden" : undefined}>
      {fmt(minor, { sign, compact })}
    </span>
  );
}

/** Big balance number with smaller centavos, in the oversized style of the brief. */
export function BigMoney({ minor, className, centsClass }: { minor: number; className?: string; centsClass?: string }) {
  const { hidden } = useMoney();
  if (hidden)
    return (
      <span className={cx("num amount font-semibold", className)} aria-label="Amount hidden">
        ₱<span className="tracking-[0.12em] opacity-70">••••••</span>
      </span>
    );
  const s = formatMoney(minor);
  const dot = s.lastIndexOf(".");
  return (
    <span className={cx("num amount font-semibold", className)} aria-label={s}>
      {s.slice(0, dot)}
      <span className={cx("opacity-50", centsClass)}>{s.slice(dot)}</span>
    </span>
  );
}

export function PageHeader({
  title,
  back,
  action,
  subtitle,
}: {
  title: string;
  back?: string | true;
  action?: ReactNode;
  subtitle?: ReactNode;
}) {
  const router = useRouter();
  return (
    <header className="pt-safe sticky top-0 z-20 bg-bg/85 px-4 pb-3 backdrop-blur-xl lg:static lg:bg-transparent lg:pt-6 lg:pb-5 lg:backdrop-blur-none">
      <div className="flex min-h-12 items-center gap-2">
        {back &&
          (back === true ? (
            <button onClick={() => animatedBack(() => router.back())} className="-ml-2 grid size-11 place-items-center rounded-full active:bg-pale" aria-label="Back">
              <ChevronLeft className="size-6" />
            </button>
          ) : (
            <Link href={back} className={cx("-ml-2 grid size-11 place-items-center rounded-full active:bg-pale lg:hover:bg-pale", back === "/home" && "lg:hidden")} aria-label="Back">
              <ChevronLeft className="size-6" />
            </Link>
          ))}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[1.6rem] leading-tight font-semibold tracking-tight lg:text-[2rem]">{title}</h1>
          {subtitle && <div className="text-sm text-ink-3">{subtitle}</div>}
        </div>
        {action}
      </div>
    </header>
  );
}

export function Button({
  children,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 font-medium transition active:scale-[0.98] disabled:opacity-40",
        variant === "primary" && "bg-brand text-white shadow-soft",
        variant === "secondary" && "bg-pale text-brand",
        variant === "ghost" && "text-brand active:bg-pale",
        variant === "danger" && "bg-expense/10 text-expense",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Card({ children, className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...p} className={cx("rounded-3xl border border-line p-4 shadow-soft", !/(^|\s)bg-/.test(className ?? "") && "bg-white", className)}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-end justify-between px-1">
      <h2 className="text-[0.95rem] font-semibold tracking-tight">{children}</h2>
      {action}
    </div>
  );
}

export function Field({ label, children, hint, error }: { label: string; children: (id: string) => ReactNode; hint?: ReactNode; error?: string }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block px-1 text-sm font-medium text-ink-2">
        {label}
      </label>
      {children(id)}
      {hint && !error && <p className="px-1 text-xs text-ink-3">{hint}</p>}
      {error && <p className="px-1 text-xs text-expense">{error}</p>}
    </div>
  );
}

export const inputCls =
  "w-full min-h-12 text-[16px] rounded-2xl border border-line bg-white px-4 text-ink outline-none placeholder:text-ink-3";

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
  size?: "sm" | "md";
}) {
  const id = useId();
  return (
    <div role="tablist" className={cx("flex rounded-2xl bg-pale p-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cx(
              "relative flex-1 rounded-xl font-medium whitespace-nowrap transition-colors",
              size === "sm" ? "min-h-9 px-2 text-sm" : "min-h-11 px-3",
              active ? "text-ink" : "text-ink-2",
            )}
          >
            {active && (
              <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-xl bg-white shadow-soft" transition={{ type: "spring", bounce: 0.2, duration: 0.4 }} />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Chip({ active, children, onClick, className }: { active?: boolean; children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition",
        active ? "border-brand bg-brand text-white" : "border-line bg-white text-ink-2",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      {icon && <div className="mb-3 grid size-14 place-items-center rounded-2xl bg-pale text-brand">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {body && <p className="mt-1 max-w-xs text-sm text-ink-3">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  // Rendered into <body> so a sheet can open from inside another sheet (e.g. the date picker in "Record a debt")
  // without being trapped by the parent's transform.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation(); // only the topmost sheet closes
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
          <motion.div className="absolute inset-0 bg-brand-deep/40 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="absolute inset-x-0 bottom-0 mx-auto max-h-[88dvh] max-w-md overflow-y-auto rounded-t-[2rem] lg:bottom-8 lg:rounded-[2rem] bg-bg px-4 pt-2 pb-[calc(1.25rem+var(--safe-bottom))] shadow-float"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 340 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, i) => (i.offset.y > 110 || i.velocity.y > 600) && onClose()}
          >
            <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-line" />
            {title && (
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold">{title}</h2>
                <button onClick={onClose} className="grid size-10 place-items-center rounded-full bg-pale" aria-label="Close">
                  <X className="size-5" />
                </button>
              </div>
            )}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function Avatar({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span className="grid shrink-0 place-items-center rounded-full font-semibold text-white" style={{ width: size, height: size, background: color, fontSize: size * 0.38 }} aria-hidden="true">
      {initials || "?"}
    </span>
  );
}

export function Progress({ value, className, color = "var(--color-brand-2)" }: { value: number; className?: string; color?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cx("h-2 overflow-hidden rounded-full bg-pale", className)} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <motion.div className="h-full rounded-full" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${v}%` }} transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }} />
    </div>
  );
}

export function Loading() {
  return (
    <div className="space-y-3 p-4" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-20 animate-pulse rounded-3xl bg-pale" />
      ))}
    </div>
  );
}
