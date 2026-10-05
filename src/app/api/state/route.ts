import { buildView } from "@/lib/game";
import { fail, isHost, json, playerFrom } from "@/lib/server";
import { getStore } from "@/lib/store";
import type { Role } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const param = new URL(req.url).searchParams.get("role");
  const role: Role = param === "admin" || param === "tv" ? param : "player";
  // The TV shows the game code, so it needs the host PIN as much as the remote does.
  if (role !== "player" && !isHost(req)) return fail("Wrong host PIN", 401);

  const store = getStore();
  const snap = await store.snapshot();
  const me = role === "player" ? playerFrom(req, snap) : null;
  return json(buildView(snap, role, me?.id ?? null, store.persistent));
}
