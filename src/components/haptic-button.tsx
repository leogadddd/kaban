"use client";

import Link from "next/link";
import type { ComponentProps, ComponentPropsWithRef, ReactElement } from "react";

/** Keep the real control in the tab order and use its normal click and form behavior. */
function HapticTarget({ children, className }: { children: ReactElement; className?: string }) {
  return (
    <span
      className={className ? `haptic-target ${className}` : "haptic-target"}
      onClickCapture={({ nativeEvent, target }) => {
        if (!nativeEvent.isTrusted || !("pointerType" in nativeEvent) || nativeEvent.pointerType !== "touch") return;
        const control = target instanceof Element && target.closest("button:enabled, a[href]");
        if (control && control.getAttribute("aria-disabled") !== "true") navigator.vibrate?.(10);
      }}
    >
      {children}
      {/* The label receives the tap so WebKit supplies a trusted switch click without blocking scrolling. */}
      <label aria-hidden="true" data-haptic-tap>
        <input
          type="checkbox"
          {...{ switch: "" }}
          tabIndex={-1}
          className="pointer-events-none invisible absolute size-px"
          onChange={(event) => {
            const control = event.currentTarget.parentElement?.previousElementSibling;
            if (control instanceof HTMLElement && control.getAttribute("aria-disabled") !== "true") control.click();
          }}
        />
      </label>
    </span>
  );
}

export type HapticButtonProps = ComponentPropsWithRef<"button"> & { wrapperClassName?: string };

export function HapticButton({ wrapperClassName, ...props }: HapticButtonProps) {
  return (
    <HapticTarget className={wrapperClassName}>
      <button {...props} />
    </HapticTarget>
  );
}

export function HapticLink({ wrapperClassName, ...props }: ComponentProps<typeof Link> & { wrapperClassName?: string }) {
  return (
    <HapticTarget className={wrapperClassName}>
      <Link {...props} />
    </HapticTarget>
  );
}
