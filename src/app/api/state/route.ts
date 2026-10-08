import { buildView } from "@/lib/game";
import { fail, isHost, json, playerFrom } from "@/lib/server";
import { getStore } from "@/lib/store";
import type { Role } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const query = new URL(req.url).searchParams;
  const param = query.get("role");
  const role: Role = param === "admin" || param === "tv" ? param : "player";
  // The TV shows the game code, so it needs the host PIN as much as the remote does.
  if (role !== "player" && !isHost(req)) return fail("Wrong host PIN", 401);

  const store = getStore();
  let snap = await store.snapshot();
  // Each server instance caches reads briefly. Skip the cache when it is older
  // than what this screen has already seen (`v`), or when it doesn't know a
  // phone that says it joined, so no screen ever steps backwards.
  const behind = snap.state.version < (Number(query.get("v")) || 0);
  const unknown = role === "player" && req.headers.has("x-player") && !playerFrom(req, snap);
  if (behind || unknown) snap = await store.snapshot(true);
  const me = role === "player" ? playerFrom(req, snap) : null;
  return json(buildView(snap, role, me?.id ?? null, store.persistent));
}
