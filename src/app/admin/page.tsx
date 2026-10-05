"use client";

import Link from "next/link";
import { useState } from "react";
import { PinGate } from "@/components/PinGate";
import { drinkName, playerOf, post, useCountdown, useGame, useHydrated, useStored } from "@/lib/client";
import type { Cup, CurrentView, Drink, View } from "@/lib/types";

type Send = (action: string, extra?: Record<string, unknown>) => Promise<boolean>;

const BTN =
  "rounded-2xl px-4 py-3 font-bold transition active:translate-y-0.5 disabled:opacity-40";
const GHOST = `${BTN} border-2 border-bark bg-soil text-cream`;

export default function AdminPage() {
  const hydrated = useHydrated();
  const [pin, setPin] = useStored<string>("npl:pin");
  const { view, status, refresh } = useGame("admin", { pin }, hydrated && !!pin);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const send: Send = async (action, extra = {}) => {
    setBusy(true);
    const res = await post("/api/admin", { action, ...extra }, { pin });
    setBusy(false);
    setError(res.error);
    await refresh();
    return !res.error;
  };

  if (!hydrated) return null;
  if (!pin || status === "denied") {
    return (
      <PinGate icon="🧑‍⚖️" title="Commissioner's office" wrong={!!pin && status === "denied"} onSubmit={setPin} />
    );
  }
  if (!view) return <main className="m-auto text-6xl">🎃</main>;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-16 pt-4">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-xl text-rind">🧑‍⚖️ Commissioner</h1>
        <nav className="flex gap-3 text-sm font-semibold text-cream/70 underline">
          <Link href="/tv" target="_blank">TV</Link>
          <Link href="/" target="_blank">Player</Link>
        </nav>
      </header>

      <p className="flex items-center justify-between rounded-2xl border-2 border-bark bg-soil px-4 py-2 font-semibold">
        <span className="text-cream/70">Game code</span>
        <span className="font-display text-2xl tracking-[0.2em] text-rind">{view.code}</span>
      </p>

      {!view.persistent && (
        <p className="rounded-xl border border-rind/40 bg-rind/10 px-3 py-2 text-sm text-rind">
          Dev mode: game state lives in this server&apos;s memory. Add Redis before deploying.
        </p>
      )}
      {error && <p className="rounded-xl bg-blood/20 px-3 py-2 font-semibold text-blood">{error}</p>}

      {view.phase === "lobby" ? (
        <Setup view={view} send={send} busy={busy} />
      ) : (
        <Remote view={view} send={send} busy={busy} />
      )}

      <Roster view={view} send={send} />
      <Danger send={send} onLogout={() => setPin(null)} />
    </main>
  );
}

// ---------- setup ----------

function toText(drinks: Drink[]): string {
  return [...drinks]
    .sort((a, b) => a.seed - b.seed)
    .map((d) => (d.abv ? `${d.name}, ${d.abv}` : d.name))
    .join("\n");
}

/** One drink per line, optional ABV after a comma: `Pumking, 8.6`. */
function fromText(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.*),\s*(\d+(?:\.\d+)?)\s*%?$/);
      return match ? { name: match[1].trim(), abv: Number(match[2]) } : { name: line, abv: null };
    });
}

function Setup({ view, send, busy }: { view: View; send: Send; busy: boolean }) {
  const [title, setTitle] = useState(view.title);
  const [text, setText] = useState(() => toText(view.drinks));
  const [poolStd, setPoolStd] = useState(view.poolStd);
  const [shuffle, setShuffle] = useState(true);
  const drinks = fromText(text);
  const dirty = title !== view.title || text.trim() !== toText(view.drinks) || poolStd !== view.poolStd;
  const save = () => send("setup", { title, drinks, poolStd });

  return (
    <section className="flex flex-col gap-3 rounded-3xl border-2 border-bark bg-soil p-4">
      <h2 className="font-display text-lg">Tournament setup</h2>
      <label className="flex flex-col gap-1 text-sm font-semibold text-cream/70">
        League name
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={40}
          className="rounded-xl border-2 border-bark bg-ink px-3 py-2 text-base text-cream outline-none focus:border-pulp"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold text-cream/70">
        Drinks · one per line, optional ABV after a comma
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={9}
          placeholder={"Pumking, 8.6\nPumpkinhead, 4.5\nSpiked Pumpkin Cider, 6"}
          className="rounded-xl border-2 border-bark bg-ink px-3 py-2 font-mono text-base text-cream outline-none placeholder:text-cream/25 focus:border-pulp"
        />
      </label>
      <label className="flex items-center justify-between gap-3 text-sm font-semibold text-cream/70">
        Leftover pool per drink (standard drinks)
        <select
          value={poolStd}
          onChange={(e) => setPoolStd(Number(e.target.value))}
          className="rounded-xl border-2 border-bark bg-ink px-3 py-2 text-base text-cream"
        >
          {[0.25, 0.5, 0.75, 1, 1.5, 2].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold text-cream/70">
        <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} className="size-5 accent-pulp" />
        Randomize the seeding
      </label>
      <p className="text-sm text-cream/60">
        {drinks.length} drinks → {Math.max(0, drinks.length - 1)} matchups · {view.players.length} players signed
      </p>
      <div className="grid grid-cols-2 gap-3">
        <button disabled={busy || !dirty} onClick={save} className={GHOST}>
          {dirty ? "Save" : "Saved ✓"}
        </button>
        <button
          disabled={busy || drinks.length < 2}
          onClick={async () => {
            if (dirty && !(await save())) return;
            await send("start", { shuffle });
          }}
          className={`${BTN} bg-pulp text-ink`}
        >
          Start tournament
        </button>
      </div>
    </section>
  );
}

// ---------- live remote ----------

function advanceLabel(view: View, cur: CurrentView | null): string | null {
  switch (view.phase) {
    case "bracket":
      return "🔔 Open voting";
    case "voting":
      return `🥁 Close voting (${cur?.locked.length ?? 0}/${(cur?.market.length ?? 0) + (cur?.taste.length ?? 0)} in)`;
    case "taste":
      return cur?.tie ? "Break the tie first ↓" : "💰 Unmask cups + clear market";
    case "clearing":
      return cur && cur.number >= cur.total ? "🏆 Crown the champion" : "Next matchup →";
    default:
      return null;
  }
}

const HINT: Partial<Record<View["phase"], string>> = {
  bracket: "Market pours the cups now (their phones say which is A and B). Open voting when cups are down.",
  voting: "Market buys, tasters pick. Closing starts a 3-second drumroll, then the taste verdict.",
  taste: "TV shows the winning cup. Next: reveal which drink was which, who bought what, and who drinks what.",
  clearing: "Everybody finishes their share. Then move on.",
  champion: "That's the season. Restart below to run it back.",
};

function Remote({ view, send, busy }: { view: View; send: Send; busy: boolean }) {
  const cur = view.current;
  const label = advanceLabel(view, cur);
  const [spoil, setSpoil] = useState(false);
  // Screens are mid-countdown; the server refuses the next switch until they land.
  const remaining = useCountdown(view.switchAt);
  const hold = busy || remaining > 0;

  return (
    <section className="flex flex-col gap-3 rounded-3xl border-2 border-bark bg-soil p-4">
      {cur ? (
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-cream/60">
            Match {cur.number} of {cur.total} · {cur.roundName}
          </p>
          <h2 className="font-display text-xl leading-tight">
            {drinkName(view, cur.top)} <span className="text-cream/50">vs</span> {drinkName(view, cur.bottom)}
          </h2>
        </div>
      ) : (
        <h2 className="font-display text-xl text-pulp">🏆 {drinkName(view, view.champion)}</h2>
      )}
      <p className="text-sm text-cream/70">{HINT[view.phase]}</p>
      {remaining > 0 && (
        <p className="rounded-xl bg-rind/15 px-3 py-2 text-center font-bold text-rind">
          ⏱ Screens switch in {Math.ceil(remaining / 1000)}…
        </p>
      )}

      {label && (
        <button
          disabled={hold || !!cur?.tie}
          onClick={() => send("advance")}
          className={`${BTN} bg-pulp py-6 font-display text-xl text-ink shadow-[0_6px_0_#a84a00] active:shadow-none`}
        >
          {label}
        </button>
      )}

      {cur?.tie && (
        <div className="grid grid-cols-3 gap-2">
          {(["A", "B"] as Cup[]).map((cup) => (
            <button key={cup} disabled={hold} onClick={() => send("tiebreak", { cup })} className={GHOST}>
              {cup} wins
            </button>
          ))}
          <button disabled={hold} onClick={() => send("tiebreak", { cup: "coin" })} className={GHOST}>
            🪙 Flip
          </button>
        </div>
      )}
      {view.phase === "bracket" && (
        <button disabled={hold} onClick={() => send("reshuffle")} className={GHOST}>
          🔀 Reshuffle parties + cups
        </button>
      )}
      {view.phase === "taste" && (
        <button disabled={hold} onClick={() => send("reopen")} className={GHOST}>
          ↩ Closed too early? Reopen voting
        </button>
      )}

      {cur && (
        <>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {(["market", "taste"] as const).map((party) => (
              <div key={party} className="rounded-2xl bg-ink p-3">
                <p className="mb-1 font-bold text-rind">{party === "market" ? "👀 Market" : "👅 Taste"}</p>
                {cur[party].map((id) => (
                  <p key={id} className={cur.locked.includes(id) ? "" : "text-cream/40"}>
                    {cur.locked.includes(id) ? "✓" : "…"} {playerOf(view, id).name}
                  </p>
                ))}
                {cur[party].length === 0 && <p className="text-cream/40">nobody</p>}
              </div>
            ))}
          </div>
          {cur.cups && (
            <button onClick={() => setSpoil(!spoil)} className="rounded-2xl bg-ink p-3 text-left text-sm">
              {spoil ? (
                <>
                  <b>A</b> = {drinkName(view, cur.cups.A)}
                  <br />
                  <b>B</b> = {drinkName(view, cur.cups.B)}
                </>
              ) : (
                <span className="text-cream/50">🙈 Tap to show which cup is which (spoiler if you&apos;re tasting)</span>
              )}
            </button>
          )}
        </>
      )}
    </section>
  );
}

function Roster({ view, send }: { view: View; send: Send }) {
  return (
    <section className="rounded-3xl border-2 border-bark bg-soil p-4">
      <h2 className="font-display text-lg">Players ({view.players.length})</h2>
      <div className="mt-2 flex flex-wrap gap-2">
        {view.players.map((p) => (
          <button
            key={p.id}
            onClick={() => confirm(`Kick ${p.name}?`) && send("kick", { id: p.id })}
            className="rounded-full bg-ink px-3 py-1 text-sm font-semibold"
          >
            {p.avatar} {p.name} <span className="text-cream/40">✕</span>
          </button>
        ))}
        {view.players.length === 0 && <p className="text-sm text-cream/50">Nobody yet. Put the TV page up.</p>}
      </div>
    </section>
  );
}

function Danger({ send, onLogout }: { send: Send; onLogout: () => void }) {
  return (
    <section className="flex flex-col gap-2 rounded-3xl border-2 border-blood/40 p-4">
      <h2 className="font-display text-lg text-blood">Danger zone</h2>
      <button
        onClick={() => confirm("Restart the tournament? Bracket and results are erased. Players, drinks and the game code stay.") && send("reset")}
        className={GHOST}
      >
        Restart tournament (same players)
      </button>
      <button
        onClick={() => confirm("Start a new game? Everyone is signed out and a new game code is issued. Drinks stay.") && send("reset", { wipe: true })}
        className={GHOST}
      >
        New game (new code)
      </button>
      <button onClick={onLogout} className="pt-1 text-sm text-cream/50 underline">
        Forget PIN on this device
      </button>
    </section>
  );
}
