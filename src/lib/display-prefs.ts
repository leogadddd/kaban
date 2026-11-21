"use client";
// Display preferences kept in the ledger's meta table (this device, this ledger), like "Hide amounts".
import { useMeta } from "./hooks";
import { setMeta } from "./repo";
import type { Txn } from "./types";

const HIDE_VOIDED = "hideVoided";

/** Hide voided transactions from Home, account pages and card views. Nothing is deleted. */
export function useHideVoided(): [boolean, (v: boolean) => void] {
  const on = useMeta<boolean>(HIDE_VOIDED) === true;
  return [on, (v) => void setMeta(HIDE_VOIDED, v)];
}

/** The list as it should be shown: without voided entries while the setting is on. */
export function useVisibleTxns(txns: Txn[]): Txn[] {
  const [hide] = useHideVoided();
  return hide ? txns.filter((t) => t.state !== "void") : txns;
}

const SHOW_ARCHIVED = "showArchived";

/** Show archived accounts and people in lists and filters. Archived items never count toward totals either way. */
export function useShowArchived(): [boolean, (v: boolean) => void] {
  const on = useMeta<boolean>(SHOW_ARCHIVED) === true;
  return [on, (v) => void setMeta(SHOW_ARCHIVED, v)];
}
