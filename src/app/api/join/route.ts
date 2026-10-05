import { randomBytes } from "node:crypto";
import { pickAvatar } from "@/lib/game";
import { fail, json } from "@/lib/server";
import { getStore } from "@/lib/store";

const MAX_PLAYERS = 40;
const MAX_NAME = 14;

const newSecret = () => randomBytes(16).toString("hex");

/**
 * Step 1: `{ code }` checks the game code.
 * Step 2: `{ code, name }` joins. A taken name answers 409; resend with
 * `reclaim: true` to take that seat back (for a phone that lost its login).
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    code?: unknown;
    name?: unknown;
    reclaim?: unknown;
  };

  const store = getStore();
  const snap = await store.snapshot(true);
  if (String(body.code ?? "").trim() !== snap.state.code) {
    return fail("Wrong game code", 403);
  }
  if (body.name === undefined) return json({ ok: true });

  const name = String(body.name).trim().replace(/\s+/g, " ").slice(0, MAX_NAME);
  if (!name) return fail("Name required");

  const taken = snap.players.find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (taken) {
    if (body.reclaim !== true) return fail(`${taken.name} is already signed`, 409);
    // A fresh secret logs out whichever phone held this seat before.
    const player = { ...taken, secret: newSecret() };
    await store.setPlayer(player);
    return json({ id: player.id, secret: player.secret });
  }

  if (snap.players.length >= MAX_PLAYERS) return fail("League is full");
  const player = {
    id: randomBytes(6).toString("hex"),
    secret: newSecret(),
    name,
    avatar: pickAvatar(snap.players),
    joinedAt: Date.now(),
  };
  await store.setPlayer(player);
  return json({ id: player.id, secret: player.secret });
}
