"use client";

import { ChevronLeft, Eye, EyeOff } from "lucide-react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { cx, Field, inputCls } from "@/components/ui";
import { LogoMark } from "@/lib/logo";

/** Full-screen sign-in style page: back button, brand, heading, form, footer link. */
export function AuthScreen({
  title,
  subtitle,
  children,
  footer,
  back = "/welcome",
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Where Back goes when there's no history to return to (e.g. opened from an email link). */
  back?: string;
}) {
  const router = useRouter();
  return (
    <div className="pt-safe flex min-h-dvh flex-col px-5 pb-[max(var(--safe-bottom),1.25rem)] lg:justify-center lg:py-12">
      <div className="lg:rounded-[2rem] lg:border lg:border-line lg:bg-white lg:p-8 lg:shadow-soft">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? router.back() : router.replace(back))}
          className="-ml-2 mt-2 grid size-11 place-items-center rounded-full active:bg-pale lg:mt-0 lg:hover:bg-pale"
          aria-label="Back"
        >
          <ChevronLeft className="size-6" />
        </button>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="mt-4">
          <div className="flex items-center gap-2">
            <LogoMark size={28} />
            <span className="font-semibold tracking-tight">Kaban</span>
          </div>
          <h1 className="mt-5 text-[1.9rem] leading-tight font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1.5 text-[0.95rem] text-ink-2">{subtitle}</p>}
          <div className="mt-7">{children}</div>
        </motion.div>
        {footer && <div className="mt-6 text-center text-sm text-ink-3">{footer}</div>}
      </div>
    </div>
  );
}

export function EmailField({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <Field label="Email">
      {(id) => (
        <input
          id={id}
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          autoFocus={autoFocus}
          className={inputCls}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}

export function PasswordField({
  label = "Password",
  value,
  onChange,
  autoComplete,
  hint,
  action,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  hint?: ReactNode;
  action?: ReactNode;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      {action && <div className="absolute top-0 right-1 text-sm">{action}</div>}
      <Field label={label} hint={hint}>
        {(id) => (
          <div className="relative">
            <input
              id={id}
              type={show ? "text" : "password"}
              autoComplete={autoComplete}
              autoCapitalize="none"
              spellCheck={false}
              required
              minLength={autoComplete === "new-password" ? 8 : undefined}
              className={cx(inputCls, "pr-12")}
              value={value}
              onChange={(e) => onChange(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              className="absolute inset-y-0 right-1 grid w-11 place-items-center text-ink-3"
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>
        )}
      </Field>
    </div>
  );
}

export function CodeField({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <Field label="6-digit code" error={error}>
      {(id) => (
        <input
          id={id}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoFocus
          className={cx(inputCls, "num text-center text-2xl tracking-[0.5em]")}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        />
      )}
    </Field>
  );
}

export function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p className="rounded-2xl bg-expense/10 p-3 text-sm text-expense" role="alert">
      {children}
    </p>
  );
}
