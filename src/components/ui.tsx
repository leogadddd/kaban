"use client";

import { HapticButton, HapticLink, type HapticButtonProps } from "@/components/haptic-button";
import { AnimatePresence, motion, useDragControls } from "motion/react";
import { useRouter } from "next/navigation";
import { ChevronLeft, X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type ComponentProps, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { formatMoney } from "@/lib/money";
import { useMoney } from "@/lib/privacy";
import { PrivacyToggle } from "./privacy-toggle";
// profile-menu imports Sheet from here; the cycle is safe because neither side uses the other at module load.
import { ProfileButton } from "./profile-menu";
import { animatedBack } from "@/lib/nav-direction";

const noopSubscribe = () => () => {};
/** Ids of currently open sheets, oldest first (for Escape handling). */
const openSheets: string[] = [];
let restoreSheetScroll: (() => void) | undefined;
let sheetScrollLocks = 0;

function lockSheetScroll() {
  const body = document.body;
  const root = document.documentElement;
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const previousBody = {
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    width: body.style.width,
    overflow: body.style.overflow,
  };
  const previousOverflow = root.style.overflow;
  Object.assign(body.style, {
    position: "fixed",
    top: `${-scrollY}px`,
    left: `${-scrollX}px`,
    width: "100%",
    overflow: "hidden",
  });
  root.style.overflow = "hidden";
  return () => {
    Object.assign(body.style, previousBody);
    root.style.overflow = previousOverflow;
    window.scrollTo({ left: scrollX, top: scrollY, behavior: "instant" });
  };
}
/** Remains mounted through the exit animation, including for nested sheets. */
function SheetScrollLock() {
  useLayoutEffect(() => {
    if (sheetScrollLocks++ === 0) restoreSheetScroll = lockSheetScroll();
    return () => {
      if (--sheetScrollLocks === 0) {
        restoreSheetScroll?.();
        restoreSheetScroll = undefined;
      }
    };
  }, []);
  return null;
}

const DESKTOP_MQ = "(min-width: 1024px)";
const subscribeDesktop = (cb: () => void) => {
  const m = window.matchMedia(DESKTOP_MQ);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

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
  className,
  privacy = true,
  profile = privacy,
}: {
  title: string;
  back?: string | true;
  action?: ReactNode;
  subtitle?: ReactNode;
  className?: string;
  /** Show the hide-amounts toggle (on by default; off for form screens). */
  privacy?: boolean;
  /** Show the profile avatar on phones (follows `privacy`: content screens yes, forms and utility screens no). */
  profile?: boolean;
}) {
  const router = useRouter();
  return (
    <header className={cx("pt-safe sticky top-0 z-20 bg-bg/85 px-4 pb-3 backdrop-blur-sm lg:static lg:bg-transparent lg:pt-6 lg:pb-5 lg:backdrop-blur-none", className)}>
      <div className="flex min-h-12 items-center gap-2">
        {back &&
          (back === true ? (
            <HapticButton wrapperClassName="-ml-2" onClick={() => animatedBack(() => router.back())} className="grid size-11 place-items-center rounded-full active:bg-pale" aria-label="Back">
              <ChevronLeft className="size-6" />
            </HapticButton>
          ) : (
            <HapticLink href={back} wrapperClassName={cx("-ml-2", back === "/home" && "lg:hidden")} className="grid size-11 place-items-center rounded-full active:bg-pale lg:hover:bg-pale" aria-label="Back">
              <ChevronLeft className="size-6" />
            </HapticLink>
          ))}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[1.6rem] leading-tight font-semibold tracking-tight lg:text-[2rem]">{title}</h1>
          {subtitle && <div className="text-sm text-ink-3">{subtitle}</div>}
        </div>
        {/* Desktop has one toggle in the sidebar; phones get it on screens that show amounts. */}
        {privacy && <PrivacyToggle wrapperClassName="lg:hidden" />}
        {action}
        {profile && <ProfileButton wrapperClassName="lg:hidden" />}
      </div>
    </header>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "destructive";

function buttonClass(variant: ButtonVariant, className?: string) {
  return cx(
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 font-medium transition active:scale-[0.98] disabled:opacity-40",
    variant === "primary" && "bg-brand text-on-brand shadow-soft",
    variant === "secondary" && "bg-pale text-brand",
    variant === "ghost" && "text-brand active:bg-pale",
    variant === "danger" && "bg-expense/10 text-expense",
    variant === "destructive" && "bg-expense text-on-expense shadow-soft",
    className,
  );
}

export function Button({ variant = "primary", className, ...props }: HapticButtonProps & { variant?: ButtonVariant }) {
  return <HapticButton {...props} className={buttonClass(variant, className)} />;
}

export function ButtonLink({ variant = "primary", className, ...props }: ComponentProps<typeof HapticLink> & { variant?: ButtonVariant }) {
  return <HapticLink {...props} className={buttonClass(variant, className)} />;
}

export function Card({ children, className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...p} className={cx("rounded-3xl border border-line p-4 shadow-soft", !/(^|\s)bg-/.test(className ?? "") && "bg-surface", className)}>
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
  "w-full min-h-12 text-[16px] rounded-2xl border border-line bg-field px-4 text-ink outline-none placeholder:text-ink-3";

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
          <HapticButton
            key={o.value}
            wrapperClassName="flex-1"
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cx(
              "relative rounded-xl font-medium whitespace-nowrap transition-colors",
              size === "sm" ? "min-h-9 px-2 text-sm" : "min-h-11 px-3",
              active ? "text-brand" : "text-ink-2",
            )}
          >
            {active && (
              <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-xl bg-surface shadow-soft" transition={{ type: "spring", bounce: 0.2, duration: 0.4 }} />
            )}
            <span className="relative">{o.label}</span>
          </HapticButton>
        );
      })}
    </div>
  );
}

export function ArchivedBadge() {
  return <span className="ml-1 shrink-0 rounded-full border border-line bg-surface px-2 py-0.5 text-[0.65rem] font-medium text-ink-3">Archived</span>;
}

export function Chip({ active, children, onClick, className }: { active?: boolean; children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <HapticButton
      type="button"
      wrapperClassName="shrink-0"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition",
        active ? "border-brand bg-brand/10 text-brand" : "border-line bg-surface text-ink-2",
        className,
      )}
    >
      {children}
    </HapticButton>
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

export function Sheet({
  open,
  onClose,
  title,
  children,
  appear = true,
  transitionName,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** False: if it mounts already open, show it in place instead of sliding in (e.g. restoring it on back). */
  appear?: boolean;
  /** View-transition name, so a page navigation can animate the sheet away instead of dropping it in one frame. */
  transitionName?: string;
}) {
  // Rendered into <body> so a sheet can open from inside another sheet (e.g. the date picker in "Record a debt")
  // without being trapped by the parent's transform.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const desktop = useSyncExternalStore(subscribeDesktop, () => window.matchMedia(DESKTOP_MQ).matches, () => false);
  const sheetId = useId();
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useLayoutEffect(() => {
    if (!open) return;
    openSheets.push(sheetId);
    const onKey = (e: KeyboardEvent) => {
      // Only the most recently opened sheet reacts, so Escape peels nested sheets one at a time.
      if (e.key !== "Escape" || openSheets[openSheets.length - 1] !== sheetId) return;
      closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      const i = openSheets.lastIndexOf(sheetId);
      if (i >= 0) openSheets.splice(i, 1);
    };
  }, [open, sheetId]);
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence initial={appear}>
      {open && (
        <div className="fixed inset-0 z-50 lg:grid lg:place-items-center lg:p-8" style={transitionName ? { viewTransitionName: transitionName } : undefined} role="dialog" aria-modal="true" aria-label={title}>
          <SheetScrollLock />
          <motion.div className="absolute inset-0 bg-brand-deep/40 lg:bg-brand-deep/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          {desktop ? (
            // Desktop: centered dialog that scales in.
            <motion.div
              className="relative w-full max-w-md overflow-y-auto rounded-[2rem] bg-bg px-6 pt-5 pb-6 shadow-float"
              style={{ maxHeight: "min(85dvh, 760px)" }}
              initial={{ opacity: 0, scale: 0.96, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ type: "spring", damping: 30, stiffness: 380 }}
            >
              {title && (
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{title}</h2>
                  <HapticButton onClick={onClose} className="grid size-10 place-items-center rounded-full bg-pale hover:bg-brand/10" aria-label="Close">
                    <X className="size-5" />
                  </HapticButton>
                </div>
              )}
              {children}
            </motion.div>
          ) : (
            <MobileSheet title={title} onClose={onClose}>
              {children}
            </MobileSheet>
          )}
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** The handle owns resizing gestures, leaving form content free to scroll. */
function MobileSheet({ title, onClose, children }: { title?: string; onClose: () => void; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const controls = useDragControls();
  const panel = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const dragged = useRef(false);
  const [heights, setHeights] = useState<{ compact: number; expanded: number }>();

  useLayoutEffect(() => {
    const element = panel.current;
    const heading = header.current;
    const body = content.current;
    if (!element || !heading || !body) return;
    const measure = () => {
      const rootStyle = getComputedStyle(document.documentElement);
      const panelStyle = getComputedStyle(element);
      const safeTop = parseFloat(rootStyle.getPropertyValue("--safe-top")) || 0;
      const viewport = element.parentElement?.clientHeight ?? window.innerHeight;
      const padding = parseFloat(panelStyle.paddingTop) + parseFloat(panelStyle.paddingBottom);
      const expandedHeight = Math.max(0, viewport - safeTop);
      const compactHeight = Math.max(0, Math.min(heading.offsetHeight + body.offsetHeight + padding, viewport * 0.88));
      setHeights((previous) => previous?.compact === compactHeight && previous.expanded === expandedHeight
        ? previous
        : { compact: compactHeight, expanded: expandedHeight });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(heading);
    observer.observe(body);
    observer.observe(document.documentElement);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <motion.div
      ref={panel}
      className="kb-sheet absolute inset-x-0 bottom-0 mx-auto flex max-w-md flex-col overflow-hidden rounded-t-[2rem] bg-bg px-4 pt-2 pb-[calc(1.25rem+var(--safe-bottom))] shadow-float"
      initial={{ y: "100%" }}
      animate={{ y: 0, ...(heights && { height: expanded ? heights.expanded : heights.compact }) }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 32, stiffness: 340 }}
      drag="y"
      dragListener={false}
      dragControls={controls}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.08, bottom: 0.6 }}
      onDragStart={() => { dragged.current = true; }}
      onDragEnd={(_, info) => {
        if (info.offset.y < -40) {
          setExpanded(true);
        } else if (expanded && info.offset.y > 60) {
          setExpanded(false);
        } else if (!expanded && info.offset.y > Math.max(140, (panel.current?.clientHeight ?? 0) * 0.3)) {
          onClose();
        }
      }}
    >
      <div ref={header} className="flow-root shrink-0">
        <button
          type="button"
          className="-mx-4 flex h-9 w-[calc(100%+2rem)] shrink-0 touch-none items-center justify-center cursor-grab active:cursor-grabbing"
          aria-label={expanded ? "Collapse drawer" : "Expand drawer"}
          aria-expanded={expanded}
          onPointerDown={(event) => {
            event.preventDefault();
            dragged.current = false;
            controls.start(event);
          }}
          onClick={(event) => {
            if (event.detail === 0 || !dragged.current) setExpanded((value) => !value);
          }}
        >
          <span className="h-1.5 w-10 rounded-full bg-line" />
        </button>
        {title && (
          <div className="mb-3 flex shrink-0 items-center justify-between">
            <h2 className="text-lg font-semibold">{title}</h2>
            <HapticButton onClick={onClose} className="grid size-10 place-items-center rounded-full bg-pale" aria-label="Close">
              <X className="size-5" />
            </HapticButton>
          </div>
        )}
      </div>
      <div data-viewport-scroll className="min-h-0 overflow-y-auto overscroll-contain">
        <div ref={content} className="flow-root">{children}</div>
      </div>
    </motion.div>
  );
}

export function Avatar({ name, color, avatar, size = 40 }: { name: string; color: string; avatar?: string; size?: number }) {
  if (avatar) {
    // eslint-disable-next-line @next/next/no-img-element -- family profile photos are small inline data URLs
    return <img src={avatar} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
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
