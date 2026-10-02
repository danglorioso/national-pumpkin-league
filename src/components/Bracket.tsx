"use client";

import { roundName } from "@/lib/game";
import type { View, ViewMatchup } from "@/lib/types";

function Row({
  view,
  id,
  m,
  votes,
}: {
  view: View;
  id: string | null;
  m: ViewMatchup;
  votes: number | null;
}) {
  const drink = view.drinks.find((d) => d.id === id);
  const won = !!m.winner && m.winner === id;
  const lost = !!m.winner && !!id && m.winner !== id;
  return (
    <div
      className={`flex items-center gap-[0.5em] px-[0.6em] py-[0.35em] ${
        won ? "bg-pulp text-ink" : lost ? "text-cream/35" : "text-cream"
      }`}
    >
      <span className={`w-[1.4em] shrink-0 text-center text-[0.75em] ${won ? "opacity-70" : "opacity-50"}`}>
        {drink?.seed ?? ""}
      </span>
      <span className={`min-w-0 flex-1 truncate font-semibold ${lost ? "line-through" : ""}`}>
        {drink?.name ?? (m.bye ? "bye" : "· · ·")}
      </span>
      {votes !== null && <span className="font-display text-[0.9em]">{votes}</span>}
    </div>
  );
}

export function Bracket({ view, className = "" }: { view: View; className?: string }) {
  const liveId = view.phase === "champion" ? null : view.current?.id;
  return (
    <div className={`flex h-full w-full gap-[1em] ${className}`}>
      {view.rounds.map((round, r) => (
        <div key={r} className="flex min-w-0 flex-1 flex-col gap-[0.6em]">
          <div className="truncate text-center font-display text-[0.8em] tracking-wide text-rind">
            {roundName(round.length)}
          </div>
          <div className="flex flex-1 flex-col justify-around gap-[0.6em]">
            {round.map((m) => (
              <div
                key={m.id}
                className={`overflow-hidden rounded-[0.6em] border-2 bg-soil ${
                  m.id === liveId ? "animate-glow border-rind" : "border-bark"
                } ${m.bye ? "opacity-60" : ""}`}
              >
                <Row view={view} id={m.top} m={m} votes={m.score?.[0] ?? null} />
                <div className="h-px bg-bark" />
                <Row view={view} id={m.bottom} m={m} votes={m.score?.[1] ?? null} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
