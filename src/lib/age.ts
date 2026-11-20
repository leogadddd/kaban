// Age rules for accounts: 13 and older; 13–17 need a parent or guardian's agreement.
// The same rules run on the server when the account is created (migration 20261126000000_age_check).
import { todayISO } from "./dates";

export const MIN_AGE = 13;
export const ADULT_AGE = 18;

/** Whole years between a "YYYY-MM-DD" birthday and today (or `on`). */
export function ageOn(birthday: string, on = todayISO()) {
  const [by, bm, bd] = birthday.split("-").map(Number);
  const [ty, tm, td] = on.split("-").map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

export type AgeCheck = "invalid" | "too-young" | "needs-guardian" | "adult";

export function checkAge(birthday: string): AgeCheck {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday) || birthday > todayISO() || birthday < "1900-01-01") return "invalid";
  const age = ageOn(birthday);
  if (age < MIN_AGE) return "too-young";
  return age < ADULT_AGE ? "needs-guardian" : "adult";
}
