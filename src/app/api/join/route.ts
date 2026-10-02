import { randomBytes } from "node:crypto";
import { pickAvatar } from "@/lib/game";
import { fail, json, playerFrom } from "@/lib/server";
import { getStore } from "@/lib/store";

const MAX_PLAYERS = 40;
const MAX_NAME = 14;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { name?: unknown };
  const name = String(body.name ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_NAME);
  if (!name) return fail("Name required");

  const store = getStore();
  const snap = await store.snapshot(true);

  // Same phone joining again just renames itself.
  const existing = playerFrom(req, snap);
  if (existing) {
    await store.setPlayer({ ...existing, name });
    return json({ id: existing.id, secret: existing.secret });
  }

  if (snap.players.length >= MAX_PLAYERS) return fail("League is full");
  const player = {
    id: randomBytes(6).toString("hex"),
    secret: randomBytes(16).toString("hex"),
    name,
    avatar: pickAvatar(snap.players),
    joinedAt: Date.now(),
  };
  await store.setPlayer(player);
  return json({ id: player.id, secret: player.secret });
}
