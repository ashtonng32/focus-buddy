import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Db } from "@/lib/server/api";

// Kindle (e-ink) companion sign-in. The Kindle can't do Google sign-in, so it trades a PIN
// for a long-lived token, sent as `Authorization: Bearer <token>` on the normal API routes.
// Env: KINDLE_PIN_HASH (sha256 hex of the PIN) and KINDLE_SECRET (random string for signing).
// To sign the Kindle out: bump kindle_auth.token_version.

const MAX_FAILS = 5;
const LOCK_MIN = 15;

type AuthRow = { token_version: number; failed_attempts: number; locked_until: string | null };

const sha256 = (s: string) => createHash("sha256").update(s).digest();
const sign = (payload: string) => createHmac("sha256", process.env.KINDLE_SECRET!).update(payload).digest("base64url");

function same(a: Buffer, b: Buffer) {
  return a.length === b.length && timingSafeEqual(a, b);
}

export const kindleConfigured = () => Boolean(process.env.KINDLE_PIN_HASH && process.env.KINDLE_SECRET);

async function loadRow(db: Db) {
  const { data } = await db.from("kindle_auth").select("*").eq("id", 1).single();
  return data as AuthRow | null;
}

/** True if the token was issued by us and hasn't been revoked. */
export async function verifyKindleToken(db: Db, token: string) {
  if (!kindleConfigured()) return false;
  const [tag, version, iat, sig] = token.split(".");
  if (tag !== "k1" || !version || !iat || !sig) return false;
  if (!same(Buffer.from(sig), Buffer.from(sign(`k1.${version}.${iat}`)))) return false;
  const row = await loadRow(db);
  return Boolean(row && String(row.token_version) === version);
}

type LoginResult = { ok: true; token: string } | { ok: false; locked: boolean; minutes?: number };

/** Checks the PIN, with a lockout after repeated wrong tries. */
export async function kindleLogin(db: Db, pin: string): Promise<LoginResult> {
  const row = await loadRow(db);
  if (!row) return { ok: false, locked: false };
  const now = Date.now();

  if (row.locked_until && new Date(row.locked_until).getTime() > now) {
    return { ok: false, locked: true, minutes: Math.ceil((new Date(row.locked_until).getTime() - now) / 60_000) };
  }

  const expected = Buffer.from(process.env.KINDLE_PIN_HASH!.trim().toLowerCase(), "hex");
  if (pin && same(sha256(pin), expected)) {
    await db.from("kindle_auth").update({ failed_attempts: 0, locked_until: null }).eq("id", 1);
    const payload = `k1.${row.token_version}.${now}`;
    return { ok: true, token: `${payload}.${sign(payload)}` };
  }

  const fails = row.failed_attempts + 1;
  const locked = fails >= MAX_FAILS;
  await db
    .from("kindle_auth")
    .update(
      locked
        ? { failed_attempts: 0, locked_until: new Date(now + LOCK_MIN * 60_000).toISOString() }
        : { failed_attempts: fails },
    )
    .eq("id", 1);
  return { ok: false, locked, minutes: locked ? LOCK_MIN : undefined };
}
