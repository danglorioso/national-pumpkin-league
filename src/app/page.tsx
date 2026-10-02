"use client";

import { useEffect, useRef, useState } from "react";
import { Bracket } from "@/components/Bracket";
import { type Creds, drinkName, post, useGame, useHydrated, useStored } from "@/lib/client";
import { VERDICT, ounces, share } from "@/lib/copy";
import { buzz } from "@/lib/sfx";
import type { Cup, CurrentView, View } from "@/lib/types";

type Me = NonNullable<View["me"]>;

const CUP_STYLE: Record<Cup, string> = {
  A: "bg-pulp text-ink border-pulp",
  B: "bg-hex text-ink border-hex",
};

export default function PlayPage() {
  const hydrated = useHydrated();
  const [creds, setCreds] = useStored<Creds>("npl:player");
  const { view, status, refresh } = useGame("player", { creds }, hydrated);

  // Phones buzz whenever the host moves the game along.
  const lastPhase = useRef<string | null>(null);
  useEffect(() => {
    if (!view) return;
    const key = `${view.phase}:${view.current?.id ?? ""}`;
    if (lastPhase.current && lastPhase.current !== key) buzz(view.phase === "voting" ? [60, 40, 60] : 40);
    lastPhase.current = key;
  }, [view]);

  if (!hydrated || !view) {
    return (
      <Shell>
        <p className="m-auto animate-wobble text-7xl">🎃</p>
      </Shell>
    );
  }

  if (!view.me) {
    return (
      <Shell title={view.title}>
        <Join
          onJoined={(next) => {
            setCreds(next);
            void refresh();
          }}
          creds={creds}
        />
      </Shell>
    );
  }

  return (
    <Shell title={view.title} me={view.me} offline={status === "offline"}>
      <Screen view={view} me={view.me} creds={creds} refresh={refresh} />
    </Shell>
  );
}

function Shell({
  title,
  me,
  offline,
  children,
}: {
  title?: string;
  me?: Me;
  offline?: boolean;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 pb-8 pt-4">
      <header className="flex items-center justify-between gap-3">
        <span className="font-display text-sm leading-tight text-rind">🎃 {title ?? "NPL"}</span>
        {me && (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-soil px-3 py-1 text-sm font-semibold">
            <span>{me.avatar}</span>
            {me.name}
          </span>
        )}
      </header>
      {offline && (
        <p className="rounded-xl bg-blood/20 px-3 py-2 text-center text-sm text-blood">
          Lost the league office. Reconnecting…
        </p>
      )}
      {children}
    </main>
  );
}

function Join({ onJoined, creds }: { onJoined: (c: Creds) => void; creds: Creds | null }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await post<Creds>("/api/join", { name }, { creds });
    setBusy(false);
    if (res.error || !res.data) return setError(res.error ?? "Try again");
    buzz(80);
    onJoined(res.data);
  }

  return (
    <form onSubmit={submit} className="my-auto flex flex-col gap-5">
      <div className="text-center">
        <p className="animate-wobble text-8xl">🎃</p>
        <h1 className="mt-4 font-display text-4xl leading-none text-pulp">Draft Day</h1>
        <p className="mt-2 text-cream/70">Sign your contract. No refunds. No designated hitters.</p>
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={14}
        autoFocus
        autoComplete="off"
        placeholder="Your name"
        className="rounded-2xl border-2 border-bark bg-soil px-5 py-4 text-center text-2xl font-bold outline-none placeholder:text-cream/30 focus:border-pulp"
      />
      {error && <p className="text-center text-blood">{error}</p>}
      <button
        disabled={busy || !name.trim()}
        className="rounded-2xl bg-pulp py-5 font-display text-2xl text-ink shadow-[0_6px_0_#a84a00] transition active:translate-y-1 active:shadow-none disabled:opacity-40"
      >
        {busy ? "Signing…" : "I'm in"}
      </button>
    </form>
  );
}

function Screen({
  view,
  me,
  creds,
  refresh,
}: {
  view: View;
  me: Me;
  creds: Creds | null;
  refresh: () => Promise<void>;
}) {
  const cur = view.current;
  switch (view.phase) {
    case "lobby":
      return <Lobby me={me} count={view.players.length} />;
    case "bracket":
      return cur ? <OnDeck view={view} cur={cur} me={me} /> : null;
    case "voting":
      return cur ? <Vote key={cur.id} view={view} cur={cur} me={me} creds={creds} refresh={refresh} /> : null;
    case "market":
    case "taste":
      return cur ? <Waiting view={view} cur={cur} me={me} /> : null;
    case "clearing":
      return cur ? <Clearing view={view} cur={cur} me={me} /> : null;
    case "champion":
      return <Champion view={view} me={me} />;
  }
}

function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <section className={`rounded-3xl border-2 border-bark bg-soil p-5 ${className}`}>{children}</section>;
}

function Lobby({ me, count }: { me: Me; count: number }) {
  return (
    <>
      <Card className="text-center">
        <p className="animate-wobble text-8xl">{me.avatar}</p>
        <h1 className="mt-3 font-display text-3xl text-pulp">You&apos;re in, {me.name}</h1>
        <p className="mt-1 text-cream/70">
          {count} signed so far. Eyes on the TV until kickoff.
        </p>
      </Card>
      <Card>
        <h2 className="font-display text-lg text-rind">How this works</h2>
        <ol className="mt-3 flex flex-col gap-2.5 text-[15px] leading-snug">
          <li>👀 <b>Half look, half taste.</b> You swap every matchup.</li>
          <li>💰 <b>Lookers</b> see the cans and buy the one they want to own.</li>
          <li>👅 <b>Tasters</b> go blind and pick the cup they&apos;d keep drinking. Majority advances.</li>
          <li>🍺 Lookers then split whatever they bought. <b>Fewer owners = bigger share.</b></li>
          <li>💥 <b>Nobody owns it = everybody owns it.</b></li>
        </ol>
      </Card>
    </>
  );
}

function MatchHeader({ cur }: { cur: CurrentView }) {
  return (
    <p className="text-center text-sm font-semibold uppercase tracking-widest text-cream/60">
      Match {cur.number} of {cur.total} · {cur.roundName}
    </p>
  );
}

function PartyBadge({ me }: { me: Me }) {
  if (me.party === "market") {
    return (
      <div className="text-center">
        <p className="text-6xl">👀</p>
        <h1 className="mt-2 font-display text-4xl leading-none text-rind">Market Party</h1>
        <p className="mt-2 text-lg font-semibold">Look. Don&apos;t taste.</p>
      </div>
    );
  }
  if (me.party === "taste") {
    return (
      <div className="text-center">
        <p className="text-6xl">👅</p>
        <h1 className="mt-2 font-display text-4xl leading-none text-stem">Taste Party</h1>
        <p className="mt-2 text-lg font-semibold">Taste. Don&apos;t look.</p>
      </div>
    );
  }
  return (
    <div className="text-center">
      <p className="text-6xl">🪑</p>
      <h1 className="mt-2 font-display text-3xl leading-none text-cream/80">Benched</h1>
      <p className="mt-2 text-cream/70">You joined mid-matchup. You&apos;re dealt in next round.</p>
    </div>
  );
}

function OnDeck({ view, cur, me }: { view: View; cur: CurrentView; me: Me }) {
  return (
    <>
      <MatchHeader cur={cur} />
      <Card>
        <PartyBadge me={me} />
        {me.party === "market" && cur.cups && (
          <div className="mt-5 rounded-2xl bg-ink p-4">
            <p className="text-center text-xs font-bold uppercase tracking-widest text-rind">
              Pour duty · keep the cans hidden
            </p>
            {(["A", "B"] as Cup[]).map((cup) => (
              <div key={cup} className="mt-3 flex items-center gap-3">
                <span className={`grid size-11 shrink-0 place-items-center rounded-xl font-display text-2xl ${CUP_STYLE[cup]}`}>
                  {cup}
                </span>
                <span className="text-lg font-bold leading-tight">{drinkName(view, cur.cups![cup])}</span>
              </div>
            ))}
          </div>
        )}
        {me.party === "taste" && (
          <p className="mt-5 rounded-2xl bg-ink p-4 text-center text-cream/80">
            Turn around. The Market is pouring cups <b>A</b> and <b>B</b>. No peeking at the cans.
          </p>
        )}
      </Card>
      <Card className="p-3">
        <div className="h-64 overflow-x-auto">
          <Bracket view={view} className="min-w-[420px] text-[11px]" />
        </div>
      </Card>
    </>
  );
}

function Vote({
  view,
  cur,
  me,
  creds,
  refresh,
}: {
  view: View;
  cur: CurrentView;
  me: Me;
  creds: Creds | null;
  refresh: () => Promise<void>;
}) {
  const [picked, setPicked] = useState<Cup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const choice = picked ?? me.vote;

  if (me.party === "spectator") {
    return (
      <>
        <MatchHeader cur={cur} />
        <Card>
          <PartyBadge me={me} />
        </Card>
      </>
    );
  }

  async function choose(cup: Cup) {
    buzz(cup === choice ? 20 : [30, 30, 90]);
    setPicked(cup);
    setError(null);
    const res = await post("/api/vote", { matchupId: cur.id, cup }, { creds });
    if (res.error) {
      setPicked(null);
      setError(res.error);
    }
    void refresh();
  }

  const market = me.party === "market";
  return (
    <>
      <MatchHeader cur={cur} />
      <div className="text-center">
        <p className={`font-display text-sm tracking-widest ${market ? "text-rind" : "text-stem"}`}>
          {market ? "👀 MARKET PARTY" : "👅 TASTE PARTY"}
        </p>
        <h1 className="mt-1 font-display text-3xl leading-tight">
          {market ? "Which one do you want to own?" : "Which one would you keep drinking?"}
        </h1>
      </div>
      <div className="flex flex-1 flex-col gap-4">
        {(["A", "B"] as Cup[]).map((cup) => {
          const on = choice === cup;
          return (
            <button
              key={cup}
              onClick={() => choose(cup)}
              className={`relative flex min-h-36 flex-1 flex-col items-center justify-center rounded-[2rem] border-4 px-4 transition active:scale-95 ${
                on
                  ? `${CUP_STYLE[cup]} scale-[1.02] shadow-[0_0_40px_-4px] ${cup === "A" ? "shadow-pulp" : "shadow-hex"}`
                  : choice
                    ? "border-bark bg-soil text-cream/40"
                    : `bg-soil ${cup === "A" ? "border-pulp text-pulp" : "border-hex text-hex"}`
              }`}
            >
              <span className="font-display text-7xl leading-none">{cup}</span>
              {market && cur.cups && (
                <span className="mt-2 text-center text-lg font-bold leading-tight">
                  {drinkName(view, cur.cups[cup])}
                </span>
              )}
              {on && (
                <span className="absolute right-4 top-3 animate-pop rounded-full bg-ink px-3 py-1 text-xs font-bold tracking-widest text-cream">
                  LOCKED IN
                </span>
              )}
            </button>
          );
        })}
      </div>
      {error && <p className="text-center text-blood">{error}</p>}
      <p className="text-center text-sm text-cream/60">
        {choice
          ? "Tap the other one to switch, until the host rings the bell."
          : market
            ? "Fewer owners = bigger share. Choose wisely."
            : "Your pick is your vote. Majority advances."}
      </p>
    </>
  );
}

function Waiting({ view, cur, me }: { view: View; cur: CurrentView; me: Me }) {
  const decided = view.phase === "taste" && cur.winnerCup;
  return (
    <>
      <MatchHeader cur={cur} />
      <Card className="my-auto text-center">
        {decided ? (
          <>
            <p className="font-display text-lg text-cream/70">The tasters have spoken</p>
            <p className={`mx-auto mt-4 grid size-32 animate-slam place-items-center rounded-[2rem] border-4 font-display text-8xl ${CUP_STYLE[cur.winnerCup!]}`}>
              {cur.winnerCup}
            </p>
            <h1 className="mt-4 font-display text-3xl">Cup {cur.winnerCup} advances</h1>
            {me.vote && (
              <p className="mt-2 text-lg font-semibold">
                {me.vote === cur.winnerCup ? "You were on it. 😎" : "You were not on it. 😬"}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="animate-shake text-7xl">🥁</p>
            <h1 className="mt-4 font-display text-3xl text-rind">
              {cur.tie ? "Dead heat!" : "Pencils down"}
            </h1>
            <p className="mt-2 text-cream/70">
              {cur.tie ? "The host is breaking the tie." : "Eyes on the TV."}
            </p>
            {me.vote && (
              <p className="mt-4 text-lg">
                You {me.party === "market" ? "bought" : "kept"}{" "}
                <span className={`rounded-lg px-2 py-0.5 font-display ${CUP_STYLE[me.vote]}`}>{me.vote}</span>
              </p>
            )}
          </>
        )}
      </Card>
    </>
  );
}

function Clearing({ view, cur, me }: { view: View; cur: CurrentView; me: Me }) {
  const clearing = cur.clearing;
  if (!clearing) return null;
  const kind = clearing.verdicts[me.id];
  const verdict = kind ? VERDICT[kind] : null;
  const pours = clearing.pours.filter((p) => p.playerId === me.id);
  const winner = clearing.cups[cur.winnerCup ?? "A"];
  const tone = verdict?.tone === "good" ? "text-stem" : verdict?.tone === "bad" ? "text-blood" : "text-rind";

  return (
    <>
      <MatchHeader cur={cur} />
      <Card className="text-center">
        <p className="text-sm font-bold uppercase tracking-widest text-cream/60">Advancing</p>
        <h1 className="mt-1 animate-flipin font-display text-3xl leading-tight text-pulp">
          {drinkName(view, winner.drinkId)}
        </h1>
        <p className="mt-1 text-cream/60">
          was cup {winner.cup} · beat {drinkName(view, clearing.cups[winner.cup === "A" ? "B" : "A"].drinkId)}
        </p>
      </Card>

      {verdict && (
        <Card className="animate-pop text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-cream/60">Your verdict</p>
          <h2 className={`mt-1 font-display text-3xl leading-tight ${tone}`}>{verdict.title}</h2>
          <p className="mt-2 text-cream/80">{verdict.line}</p>
        </Card>
      )}

      {me.party === "market" && (
        <Card>
          <h2 className="font-display text-lg text-rind">Your tab</h2>
          <div className="mt-3 flex flex-col gap-3">
            {pours.map((pour) => (
              <div key={pour.cup} className="flex items-center gap-3 rounded-2xl bg-ink p-3">
                <span className="text-3xl">{pour.good ? "🍺" : "🤢"}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-bold leading-tight">{drinkName(view, pour.drinkId)}</p>
                  <p className="text-sm text-cream/60">
                    {pour.crash ? "💥 Market crash · " : ""}
                    {pour.good ? "the winner" : "the loser"}
                  </p>
                </div>
                <div className={`shrink-0 text-right ${pour.good ? "text-stem" : "text-blood"}`}>
                  <p className={`font-display leading-none ${pour.owners === 1 ? "text-base" : "text-3xl"}`}>
                    {share(pour.owners)}
                  </p>
                  <p className="mt-1 text-xs text-cream/60">{ounces(pour.oz)}</p>
                </div>
              </div>
            ))}
            {pours.length === 0 && <p className="text-cream/70">Nothing. You walk away clean.</p>}
          </div>
        </Card>
      )}
      {me.party === "taste" && (
        <Card className="text-center text-cream/80">
          Finish the cup you kept. The Market mops up the rest.
        </Card>
      )}
    </>
  );
}

function Champion({ view, me }: { view: View; me: Me }) {
  const place = view.stats.findIndex((s) => s.id === me.id);
  const mine = view.stats[place];
  return (
    <>
      <Card className="text-center">
        <p className="animate-wobble text-8xl">🏆</p>
        <p className="mt-3 text-sm font-bold uppercase tracking-widest text-cream/60">League champion</p>
        <h1 className="mt-1 font-display text-4xl leading-tight text-pulp">{drinkName(view, view.champion)}</h1>
      </Card>
      {mine && (
        <Card className="text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-cream/60">Your season</p>
          <h2 className="mt-1 font-display text-5xl text-rind">#{place + 1}</h2>
          <p className="mt-1 text-lg font-semibold">{mine.points} pts on the Pumpkin Index</p>
          <p className="mt-3 text-sm text-cream/70">
            {mine.genius} contrarian hits · {mine.bags} bags held · {mine.palate} palate wins
          </p>
        </Card>
      )}
    </>
  );
}
