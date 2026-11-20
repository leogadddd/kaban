"use client";
// Terms of Service and Privacy Policy acceptance.
//
// The ledger's meta table holds what this person agreed to, so the check is instant and offline. For a
// signed-in account the sync loop also saves it to their profile on the server (accept_my_agreement) and
// pulls it back on a new device, so agreeing once covers every device. Versions live in legal-versions.ts.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { KabanDB } from "./db";
import { useMeta } from "./hooks";
import { getMeta, setMeta } from "./repo";

import { PRIVACY_VERSION, TERMS_VERSION } from "./legal-versions";

export { LEGAL_UPDATED, PRIVACY_VERSION, TERMS_VERSION } from "./legal-versions";

export interface Agreement {
  terms: string;
  privacy: string;
  /** When the person tapped Agree, on their device. */
  acceptedAt: number;
  /** Agreed on this device but not saved to the profile yet. */
  pending?: boolean;
}

const KEY = "agreement";
/** Agreed on the sign-up form, before the account's ledger exists. Applied once it opens. */
const SIGNUP_KEY = "kaban:signup-agreement";

export const useAgreement = () => useMeta<Agreement>(KEY);

export const isCurrent = (a: Pick<Agreement, "terms" | "privacy"> | null | undefined) => a?.terms === TERMS_VERSION && a?.privacy === PRIVACY_VERSION;

/** Before this flow existed, onboarding stored only a timestamp. Those people agreed to an earlier version. */
export async function agreedBefore(db: KabanDB) {
  return !!(await getMeta<Agreement>(KEY, db)) || !!(await getMeta<number>("termsAcceptedAt", db));
}

/** Saves locally right away; for a signed-in account the sync loop sends it to the profile. */
export async function acceptAgreement(db: KabanDB, acceptedAt = Date.now()) {
  await setMeta(KEY, { terms: TERMS_VERSION, privacy: PRIVACY_VERSION, acceptedAt, pending: true } satisfies Agreement, db);
  await setMeta("termsAcceptedAt", acceptedAt, db);
  const { scheduleSync } = await import("./sync");
  scheduleSync(300);
}

export function rememberSignupAgreement() {
  try {
    localStorage.setItem(SIGNUP_KEY, JSON.stringify({ terms: TERMS_VERSION, privacy: PRIVACY_VERSION, at: Date.now() }));
  } catch {}
}

/** Applies an agreement made on the sign-up form to the ledger that just opened. True if it did. */
export async function applySignupAgreement(db: KabanDB) {
  let saved: { terms?: string; privacy?: string; at?: number } | null = null;
  try {
    saved = JSON.parse(localStorage.getItem(SIGNUP_KEY) ?? "null");
    localStorage.removeItem(SIGNUP_KEY);
  } catch {}
  // Only a recent one, for the current versions: an old leftover must not answer for someone else.
  if (!saved?.at || !isCurrent(saved as Agreement) || Date.now() - saved.at > 7 * 86_400_000) return false;
  await acceptAgreement(db, saved.at);
  return true;
}

interface Remote {
  terms_version: string | null;
  privacy_version: string | null;
  accepted_at: string | null;
}

/** Called by the sync loop. Never throws: agreement trouble must not affect the ledger sync. */
export async function syncAgreement(db: KabanDB, c: SupabaseClient) {
  try {
    const local = await getMeta<Agreement>(KEY, db);
    if (local?.pending) {
      const { error } = await c.rpc("accept_my_agreement", {
        p_terms_version: local.terms,
        p_privacy_version: local.privacy,
        p_accepted_at: new Date(local.acceptedAt).toISOString(),
      });
      if (error) throw error;
      await db.transaction("rw", db.meta, async () => {
        const now = await getMeta<Agreement>(KEY, db);
        if (now?.acceptedAt === local.acceptedAt) await setMeta(KEY, { ...now, pending: false }, db);
      });
      return;
    }
    const { data, error } = await c.rpc("get_my_agreement");
    if (error) throw error;
    const remote = data as Remote | null;
    if (!remote?.terms_version || !remote.privacy_version || !remote.accepted_at) return;
    const at = Date.parse(remote.accepted_at);
    await db.transaction("rw", db.meta, async () => {
      const now = await getMeta<Agreement>(KEY, db);
      // Agreed on another device: take the server's copy unless this device has a newer local one.
      if (now?.pending || (now && now.acceptedAt >= at)) return;
      await setMeta(KEY, { terms: remote.terms_version!, privacy: remote.privacy_version!, acceptedAt: at } satisfies Agreement, db);
    });
  } catch (error) {
    // An older server without the RPCs yet: the local copy still gates the app, and it retries next sync.
    if ((error as { code?: string }).code !== "PGRST202") console.warn("agreement sync skipped", error);
  }
}
