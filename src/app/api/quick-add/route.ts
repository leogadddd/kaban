// Quick add from outside the app (iOS Shortcuts and similar). The request carries a personal token made in
// Settings → Quick add. It can only propose an entry: the user approves or rejects it the next time they
// open Kaban, and only then does a device write it into the ledger. See the quick_add migration.
import { parseMinor } from "@/lib/money";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const MESSAGES: Record<string, [number, string]> = {
  ok: [200, "Sent to Kaban. Approve it the next time you open the app."],
  missing: [401, "Kaban didn't find a token. In the shortcut, set the Authorization header to Bearer, a space, then your token from Kaban → Settings → Quick add."],
  malformed: [401, "The token in your shortcut is incomplete or isn't a Kaban token. It starts with kbn_ and is 68 characters long. Copy it again with the copy button in Kaban."],
  unauthorized: [401, "Kaban doesn't recognise this token. It may have been revoked or mistyped. Make a new one in Kaban → Settings → Quick add."],
  invalid: [400, "Kaban couldn't read that entry. Check the amount and try again."],
  rate: [429, "Too many quick adds in the last hour. Try again later."],
  limit: [429, "You have 100 quick adds waiting. Open Kaban and approve or reject them first."],
};

function reply(status: string) {
  const [code, message] = MESSAGES[status] ?? [502, "Kaban couldn't save that right now. Try again."];
  return Response.json({ ok: status === "ok", message }, { status: code, headers: { "Cache-Control": "no-store" } });
}

const text = (v: unknown) => (typeof v === "string" ? v.trim() || undefined : undefined);

/**
 * Finds the token wherever Shortcuts put it, forgiving what's easy to get wrong when setting one up: a
 * trailing newline from a Text action, extra or missing spaces, "Bearer" typed twice, upper case, or the
 * token sent as a `token` field in the JSON body instead of a header.
 */
const TOKEN = /kbn_[0-9a-f]{64}/i;
function findToken(header: string | null, body: Record<string, unknown>) {
  const fromHeader = TOKEN.exec((header ?? "").replace(/\s+/g, ""))?.[0];
  const fromBody = typeof body.token === "string" ? TOKEN.exec(body.token.replace(/\s+/g, ""))?.[0] : undefined;
  return (fromHeader ?? fromBody)?.toLowerCase();
}

/** JSON as documented; a Form body too, since that's the other Request Body choice in Shortcuts. */
function parseBody(raw: string, type: string | null): Record<string, unknown> {
  if (/application\/x-www-form-urlencoded|multipart\/form-data/i.test(type ?? "") && !/^\s*\{/.test(raw)) {
    if (/multipart/i.test(type ?? "")) throw new Error("multipart");
    return Object.fromEntries(new URLSearchParams(raw));
  }
  const body = JSON.parse(raw);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("not an object");
  return body;
}

export async function POST(request: Request) {
  if (!url || !key) return reply("unavailable");
  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return reply("invalid");
    body = parseBody(raw, request.headers.get("content-type"));
  } catch {
    return reply("invalid");
  }
  const token = findToken(request.headers.get("authorization"), body);
  if (!token) {
    // Something was sent, just not a whole token: a placeholder, or a token cut short when copying.
    const sent = (request.headers.get("authorization") ?? "").replace(/^\s*(bearer\s*)+/i, "").trim() || (typeof body.token === "string" ? body.token.trim() : "");
    // Shape only, never the value: enough to tell an empty variable from a placeholder or a cut-short token.
    const auth = request.headers.get("authorization");
    console.warn("quick add: no usable token " + JSON.stringify({
      header: auth === null ? "absent" : `${auth.length} chars`,
      bearer: auth ? /^\s*bearer/i.test(auth) : false,
      afterBearer: `${sent.length} chars`,
      kbnPrefix: /kbn_/i.test(sent),
      bodyToken: typeof body.token === "string",
      contentType: request.headers.get("content-type") ?? "none",
    }));
    return reply(sent ? "malformed" : "missing");
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
