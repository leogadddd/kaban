/**
 * Device-level "has this browser been through onboarding" flag. Welcome is only for a first open;
 * once a device has started a ledger or signed in, a missing ledger means "signed out", so it goes to sign-in.
 */
const KEY = "kaban:onboarded";

export function isOnboarded() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function markOnboarded() {
  try {
    localStorage.setItem(KEY, "1");
  } catch {}
}

/** Erasing everything on the device is a true fresh start: show Welcome again. */
export function resetOnboarded() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

/** Where to send someone who has no ledger open on this device. */
export const entryPath = () => (isOnboarded() ? "/login" : "/welcome");
