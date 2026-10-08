import type { Player, Snapshot } from "./types";

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function fail(message: string, status = 400) {
  return json({ error: message }, status);
}

/** The PIN lives only in the HOST_PIN env var; with none set, nobody is host. */
export function isHost(req: Request): boolean {
  const pin = process.env.HOST_PIN;
  return !!pin && req.headers.get("x-host-pin") === pin;
}

/** Resolves the `x-player: id:secret` header to a joined player. */
export function playerFrom(req: Request, snap: Snapshot): Player | null {
  const [id, secret] = (req.headers.get("x-player") ?? "").split(":");
  const player = snap.players.find((p) => p.id === id);
  return player && player.secret === secret ? player : null;
}
