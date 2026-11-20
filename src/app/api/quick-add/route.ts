// Quick add from outside the app (iOS Shortcuts and similar). The request carries a personal token made in
// Settings → Quick add. It can only propose an entry: the user approves or rejects it the next time they
// open Kaban, and only then does a device write it into the ledger. See the quick_add migration.
import { parseMinor } from "@/lib/money";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const MESSAGES: Record<string, [number, string]> = {
  ok: [200, "Sent to Kaban. Approve it the next time you open the app."],
  unauthorized: [401, "This quick add token isn't valid. Make a new one in Kaban → Settings → Quick add."],
  invalid: [400, "Kaban couldn't read that entry. Check the amount and try again."],
  rate: [429, "Too many quick adds in the last hour. Try again later."],
  limit: [429, "You have 100 quick adds waiting. Open Kaban and approve or reject them first."],
};

function reply(status: string) {
  const [code, message] = MESSAGES[status] ?? [502, "Kaban couldn't save that right now. Try again."];
  return Response.json({ ok: status === "ok", message }, { status: code, headers: { "Cache-Control": "no-store" } });
}

const text = (v: unknown) => (typeof v === "string" ? v.trim() || undefined : undefined);

export async function POST(request: Request) {
  if (!url || !key) return reply("unavailable");
  const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) return reply("unauthorized");

  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return reply("invalid");
    body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) return reply("invalid");
  } catch {
    return reply("invalid");
  }

  // Amount in pesos, as Shortcuts sends it: a number or text like "1,250.50".
  const amount = body.amount;
  const amountMinor = typeof amount === "number" ? (Number.isFinite(amount) ? Math.round(amount * 100) : null) : typeof amount === "string" ? parseMinor(amount) : null;
  if (!amountMinor || amountMinor <= 0) return reply("invalid");
  const type = text(body.type)?.toLowerCase() ?? "expense";

  const entry = {
    amountMinor,
    type,
    description: text(body.description) ?? text(body.note),
    category: text(body.category),
    account: text(body.account),
    date: text(body.date),
  };

  try {
    const res = await fetch(`${url}/rest/v1/rpc/quick_add_submit`, {
      method: "POST",
      // The public key alone: the request runs as the anon role, which may only call quick_add_submit.
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: token, p_entry: entry }),
      cache: "no-store",
    });
    if (!res.ok) return reply("unavailable");
    return reply(String(await res.json()));
  } catch {
    return reply("unavailable");
  }
}
