"use client";

import { useSyncExternalStore } from "react";
import { THEME_KEY } from "./theme-script";

export type ThemePref = "light" | "dark" | "system";
const EVENT = "kaban-theme";

function read(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "dark" || v === "system" ? v : "light";
  } catch {
    return "light";
  }
}

export function setThemePref(pref: ThemePref) {
  try {
    if (pref === "light") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, pref);
  } catch {}
  (window as unknown as { __kabanApplyTheme?: () => void }).__kabanApplyTheme?.();
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useThemePref(): ThemePref {
  return useSyncExternalStore(subscribe, read, () => "light");
}
