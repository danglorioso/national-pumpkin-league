import { currentMatchup } from "@/lib/game";
import { fail, json, playerFrom } from "@/lib/server";
import { getStore } from "@/lib/store";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { matchupId?: unknown; cup?: unknown };
  const cup = body.cup;
  if (cup !== "A" && cup !== "B") return fail("Pick A or B");

  const store = getStore();
  const snap = await store.snapshot(true);
  const me = playerFrom(req, snap);
  if (!me) return fail("Join first", 401);

  const m = currentMatchup(snap.state);
  if (snap.state.phase !== "voting" || !m?.played || m.id !== body.matchupId) {
    return fail("Voting is closed", 409);
  }
  if (!m.played.market.includes(me.id) && !m.played.taste.includes(me.id)) {
    return fail("You're sitting this one out", 403);
  }

  await store.setVote(m.id, me.id, cup);
  return json({ ok: true });
}
