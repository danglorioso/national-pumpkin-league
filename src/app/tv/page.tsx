"use client";

import confetti from "canvas-confetti";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { Bracket } from "@/components/Bracket";
import { drinkName, playerOf, useGame } from "@/lib/client";
import { QUIPS, VERDICT, ounces, share } from "@/lib/copy";
import { tally } from "@/lib/game";
import { enableSound, sfx } from "@/lib/sfx";
import type { Cup, CurrentView, Stat, VerdictKind, View } from "@/lib/types";

const CUPS: Cup[] = ["A", "B"];
const SUSPENSE_MS = 3200;

const CUP = {
  A: { fill: "bg-pulp text-ink", text: "text-pulp", border: "border-pulp", hex: "#ff7a18" },
  B: { fill: "bg-hex text-ink", text: "text-hex", border: "border-hex", hex: "#a970ff" },
} as const;

const PHASE_LABEL: Record<View["phase"], string> = {
  lobby: "Draft Day",
  bracket: "On Deck",
  voting: "Market Open",
  market: "Market Report",
  taste: "Taste Verdict",
  clearing: "Market Cleared",
  champion: "Champion",
};

const VERDICT_ICON: Partial<Record<VerdictKind, string>> = {
  genius: "🧠",
  bag: "💼",
  asleep: "😴",
};

function burst(colors: string[], count = 180) {
  void confetti({ particleCount: count, spread: 110, startVelocity: 55, origin: { y: 0.65 }, colors });
}

export default function TvPage() {
  const { view } = useGame("tv");
  const [sound, setSound] = useState(false);

  if (!view) {
    return (
      <main className="grid h-dvh place-items-center">
        <p className="animate-wobble text-[12vw]">🎃</p>
      </main>
    );
  }

  const cur = view.current;
  return (
    <main className="flex h-dvh w-screen flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between gap-[2vw] px-[2.5vw] py-[1.2vh]">
        <span className="font-display text-[1.8vw] text-rind">🎃 {view.title}</span>
        {cur && (
          <span className="text-[1.3vw] font-semibold uppercase tracking-[0.2em] text-cream/60">
            Match {cur.number} of {cur.total} · {cur.roundName}
          </span>
        )}
        <span className="flex items-center gap-[0.8vw] font-display text-[1.3vw]">
          <span className="size-[0.9vw] animate-pulse rounded-full bg-blood" />
          {PHASE_LABEL[view.phase]}
        </span>
      </header>

      <section className="min-h-0 flex-1 px-[2.5vw] pb-[1.5vh]">
        <Stage view={view} />
      </section>

      <Ticker view={view} />

      {!sound && (
        <button
          onClick={() => {
            enableSound();
            sfx.blip();
            setSound(true);
            void document.documentElement.requestFullscreen?.().catch(() => {});
          }}
          className="fixed bottom-[0.6vh] right-[1vw] z-10 animate-glow rounded-full bg-cream px-[1.2vw] py-[0.4vw] text-[1.1vw] font-bold text-ink"
        >
          🔊 Click for sound + fullscreen
        </button>
      )}
    </main>
  );
}

function Stage({ view }: { view: View }) {
  const cur = view.current;
  if (view.phase === "lobby") return <Lobby view={view} />;
  if (view.phase === "champion") return <Champion view={view} />;
  if (!cur) return null;
  switch (view.phase) {
    case "bracket":
      return <OnDeck key={cur.id} view={view} cur={cur} />;
    case "voting":
      return <Voting key={cur.id} view={view} cur={cur} />;
    case "market":
      return <MarketReveal key={cur.id} view={view} cur={cur} />;
    case "taste":
      return <TasteReveal key={cur.id} view={view} cur={cur} />;
    case "clearing":
      return <Clearing key={cur.id} view={view} cur={cur} />;
  }
}

// ---------- shared bits ----------

const CHIP_LOOK = {
  plain: "border-bark bg-ink text-cream",
  lit: "border-stem bg-stem text-ink",
  waiting: "border-dashed border-bark bg-transparent text-cream/45",
};

function Chip({
  view,
  id,
  look = "plain",
  cup,
  delay = 0,
}: {
  view: View;
  id: string;
  look?: keyof typeof CHIP_LOOK;
  cup?: Cup;
  delay?: number;
}) {
  const p = playerOf(view, id);
  return (
    <span
      style={{ animationDelay: `${delay}ms` }}
      className={`inline-flex animate-pop items-center gap-[0.5vw] rounded-full border-[0.2vw] px-[1vw] py-[0.35vw] text-[1.5vw] font-bold transition-colors duration-300 ${
        cup ? `${CUP[cup].border} bg-ink` : CHIP_LOOK[look]
      }`}
    >
      <span>{p.avatar}</span>
      {p.name}
    </span>
  );
}

function CupTile({ cup, className = "" }: { cup: Cup; className?: string }) {
  return (
    <span className={`grid aspect-square place-items-center rounded-[18%] font-display leading-none ${CUP[cup].fill} ${className}`}>
      {cup}
    </span>
  );
}

function Panel({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`rounded-[1.6vw] border-[0.2vw] border-bark bg-soil/80 p-[1.6vw] ${className}`}>{children}</div>;
}

function Leaderboard({ view, limit = 5 }: { view: View; limit?: number }) {
  const rows = view.stats.slice(0, limit);
  return (
    <div className="flex flex-col gap-[0.5vw]">
      {rows.map((s, i) => {
        const p = playerOf(view, s.id);
        return (
          <div key={s.id} className="flex items-center gap-[0.8vw] text-[1.4vw] font-semibold">
            <span className="w-[1.6vw] font-display text-rind">{i + 1}</span>
            <span>{p.avatar}</span>
            <span className="min-w-0 flex-1 truncate">{p.name}</span>
            <span className="font-display">{s.points}</span>
          </div>
        );
      })}
    </div>
  );
}

function Ticker({ view }: { view: View }) {
  const leader = view.stats[0];
  const items = [...QUIPS];
  if (leader && leader.points > 0) {
    items.unshift(`${playerOf(view, leader.id).name} leads the Pumpkin Index at ${leader.points} pts.`);
  }
  const bagger = [...view.stats].sort((a, b) => b.bags - a.bags)[0];
  if (bagger && bagger.bags > 0) {
    items.splice(3, 0, `${playerOf(view, bagger.id).name} is holding ${bagger.bags} bag${bagger.bags > 1 ? "s" : ""}. Thoughts and prayers.`);
  }
  return (
    <footer className="shrink-0 overflow-hidden border-t-[0.2vw] border-bark bg-ink py-[0.8vh]">
      <div className="flex w-max animate-marquee whitespace-nowrap text-[1.3vw] font-semibold text-cream/70">
        {[0, 1].map((copy) => (
          <span key={copy} aria-hidden={copy === 1}>
            {items.map((text) => (
              <span key={text} className="mx-[2vw]">
                <span className="mr-[2vw] text-pulp">🎃</span>
                {text}
              </span>
            ))}
          </span>
        ))}
      </div>
    </footer>
  );
}

// ---------- lobby ----------

function Lobby({ view }: { view: View }) {
  const [join, setJoin] = useState<{ url: string; qr: string } | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      let url = window.location.origin;
      if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
        const lan = await fetch("/api/lan").then((r) => r.json()).catch(() => null);
        if (lan?.url) url = lan.url;
      }
      const qr = await QRCode.toDataURL(url, {
        margin: 1,
        width: 640,
        color: { dark: "#120904", light: "#fff1dc" },
      });
      if (alive) setJoin({ url, qr });
    })().catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const count = useRef(view.players.length);
  useEffect(() => {
    if (view.players.length > count.current) sfx.blip();
    count.current = view.players.length;
  }, [view.players.length]);

  return (
    <div className="grid h-full grid-cols-[1.25fr_1fr] gap-[3vw]">
      <div className="flex min-h-0 flex-col justify-center gap-[3vh]">
        <h1 className="font-display text-[7.2vw] leading-[0.88] text-pulp drop-shadow-[0_0.5vw_0_#7a3300]">
          {view.title}
        </h1>
        <p className="text-[2.2vw] font-semibold text-cream/80">Half look. Half taste. Everybody drinks.</p>
        <div className="flex flex-wrap content-start gap-[0.8vw]">
          {view.players.map((p) => (
            <Chip key={p.id} view={view} id={p.id} />
          ))}
          {view.players.length === 0 && (
            <span className="text-[1.6vw] text-cream/50">Waiting for the first brave soul…</span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-center justify-center gap-[2vh]">
        <p className="font-display text-[2.6vw] text-rind">Scan to get drafted</p>
        <div className="aspect-square w-[70%] overflow-hidden rounded-[2vw] bg-cream p-[1vw] shadow-[0_0_6vw_-1vw] shadow-pulp">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {join && <img src={join.qr} alt="QR code to join" className="size-full" />}
        </div>
        <p className="text-[1.8vw] font-bold">{join?.url.replace(/^https?:\/\//, "")}</p>
        <p className="text-[1.3vw] text-cream/60">
          {view.players.length} signed · {view.drinks.length} drinks in the field
        </p>
      </div>
    </div>
  );
}

// ---------- bracket / on deck ----------

function OnDeck({ view, cur }: { view: View; cur: CurrentView }) {
  const played = view.stats.some((s) => s.points !== 0);
  return (
    <div className="grid h-full grid-cols-[1.9fr_1fr] gap-[2vw]">
      <Panel className="min-h-0">
        <Bracket view={view} className="text-[1.25vw]" />
      </Panel>
      <div className="flex min-h-0 flex-col gap-[1.5vh]">
        <Panel className="animate-rise text-center">
          <p className="font-display text-[1.4vw] tracking-widest text-rind">On deck</p>
          <p className="mt-[0.5vw] font-display text-[2.3vw] leading-tight">{drinkName(view, cur.top)}</p>
          <p className="font-display text-[1.5vw] text-cream/50">vs</p>
          <p className="font-display text-[2.3vw] leading-tight">{drinkName(view, cur.bottom)}</p>
        </Panel>
        <Panel className="flex-1">
          <p className="font-display text-[1.4vw] text-rind">👀 Market · look, pour, don&apos;t taste</p>
          <div className="mt-[0.8vw] flex flex-wrap gap-[0.6vw]">
            {cur.market.map((id, i) => (
              <Chip key={id} view={view} id={id} delay={i * 60} />
            ))}
          </div>
          <p className="mt-[1.4vw] font-display text-[1.4vw] text-stem">👅 Taste · turn around</p>
          <div className="mt-[0.8vw] flex flex-wrap gap-[0.6vw]">
            {cur.taste.map((id, i) => (
              <Chip key={id} view={view} id={id} delay={i * 60} />
            ))}
          </div>
        </Panel>
        {played && (
          <Panel>
            <p className="mb-[0.6vw] font-display text-[1.4vw] text-rind">Pumpkin Index</p>
            <Leaderboard view={view} limit={4} />
          </Panel>
        )}
      </div>
    </div>
  );
}

// ---------- voting ----------

function Voting({ view, cur }: { view: View; cur: CurrentView }) {
  useEffect(() => sfx.bell(), []);
  const locked = useRef(cur.locked.length);
  useEffect(() => {
    if (cur.locked.length > locked.current) sfx.blip();
    locked.current = cur.locked.length;
  }, [cur.locked.length]);

  const total = cur.market.length + cur.taste.length;
  const allIn = total > 0 && cur.locked.length === total;
  const roster = (ids: string[]) =>
    ids.map((id) => (
      <Chip key={id} view={view} id={id} look={cur.locked.includes(id) ? "lit" : "waiting"} />
    ));

  return (
    <div className="flex h-full flex-col items-center justify-center gap-[3vh]">
      <div className="flex items-center gap-[3vw]">
        <CupTile cup="A" className="w-[15vw] animate-wobble text-[11vw]" />
        <span className="font-display text-[5vw] text-cream/50">vs</span>
        <CupTile cup="B" className="w-[15vw] animate-wobble text-[11vw] [animation-delay:-1.3s]" />
      </div>
      <p className={`font-display text-[3vw] ${allIn ? "animate-pop text-stem" : "text-cream"}`}>
        {allIn ? "All in. Ring the bell!" : `${cur.locked.length} of ${total} locked in`}
      </p>
      <div className="grid w-full grid-cols-2 gap-[2vw]">
        <Panel>
          <p className="font-display text-[1.6vw] text-rind">👀 Market · which one do you want to own?</p>
          <div className="mt-[1vw] flex flex-wrap gap-[0.7vw]">{roster(cur.market)}</div>
        </Panel>
        <Panel>
          <p className="font-display text-[1.6vw] text-stem">👅 Taste · which one would you keep drinking?</p>
          <div className="mt-[1vw] flex flex-wrap gap-[0.7vw]">{roster(cur.taste)}</div>
        </Panel>
      </div>
    </div>
  );
}

// ---------- market reveal ----------

function MarketReveal({ view, cur }: { view: View; cur: CurrentView }) {
  useEffect(() => sfx.kaching(), []);
  const buys = cur.buys ?? {};
  const asleep = cur.market.filter((id) => !buys[id]);
  return (
    <div className="flex h-full flex-col gap-[2vh]">
      <h1 className="text-center font-display text-[4vw] leading-none text-rind">The market has spoken</h1>
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-[2vw]">
        {CUPS.map((cup, c) => {
          const buyers = cur.market.filter((id) => buys[id] === cup);
          return (
            <Panel key={cup} className={`flex flex-col items-center gap-[2vh] ${CUP[cup].border}`}>
              <CupTile cup={cup} className="w-[9vw] text-[6.5vw]" />
              <p className="font-display text-[2.6vw]">
                {buyers.length} owner{buyers.length === 1 ? "" : "s"}
              </p>
              <div className="flex flex-wrap justify-center gap-[0.7vw]">
                {buyers.map((id, i) => (
                  <Chip key={id} view={view} id={id} cup={cup} delay={400 + (c * 3 + i) * 350} />
                ))}
              </div>
              <p className={`mt-auto text-center font-display text-[2vw] ${buyers.length === 0 ? "animate-shake text-blood" : CUP[cup].text}`}>
                {buyers.length === 0
                  ? "💥 Nobody bought it. Crash incoming."
                  : buyers.length === 1
                    ? "One owner gets ALL OF IT"
                    : `${share(buyers.length)} each`}
              </p>
            </Panel>
          );
        })}
      </div>
      {asleep.length > 0 && (
        <p className="text-center text-[1.4vw] text-cream/60">
          😴 Asleep at the bell: {asleep.map((id) => playerOf(view, id).name).join(", ")}
        </p>
      )}
    </div>
  );
}

// ---------- taste reveal ----------

function TasteReveal({ view, cur }: { view: View; cur: CurrentView }) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    sfx.drumroll(SUSPENSE_MS / 1000);
    const timer = setTimeout(() => setRevealed(true), SUSPENSE_MS);
    return () => clearTimeout(timer);
  }, []);

  const winner = revealed ? cur.winnerCup : null;
  const tie = revealed && cur.tie;
  useEffect(() => {
    if (winner) {
      sfx.airhorn();
      burst([CUP[winner].hex, "#fff1dc", "#9be15d"]);
    } else if (tie) sfx.siren();
  }, [winner, tie]);

  if (!revealed) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-[3vh]">
        <p className="animate-shake text-[14vw] leading-none">🥁</p>
        <h1 className="font-display text-[5vw] text-rind">The tasters have spoken…</h1>
      </div>
    );
  }

  const picks = cur.picks ?? {};
  const count = tally(picks);
  return (
    <div className="flex h-full flex-col gap-[2vh]">
      <h1 className="animate-slam text-center font-display text-[5vw] leading-none">
        {winner ? (
          <span className={CUP[winner].text}>Cup {winner} advances!</span>
        ) : (
          <span className="text-blood">Dead heat!</span>
        )}
      </h1>
      {cur.decidedBy && cur.decidedBy !== "taste" && (
        <p className="text-center text-[1.6vw] text-cream/70">
          Tie broken by {cur.decidedBy === "coin" ? "coin flip 🪙" : "the commissioner 🧑‍⚖️"}
        </p>
      )}
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-[2vw]">
        {CUPS.map((cup) => {
          const fans = cur.taste.filter((id) => picks[id] === cup);
          const lost = winner && winner !== cup;
          return (
            <Panel
              key={cup}
              className={`flex flex-col items-center gap-[2vh] transition-opacity duration-700 ${CUP[cup].border} ${lost ? "opacity-40" : ""}`}
            >
              <div className="flex items-center gap-[2vw]">
                <CupTile cup={cup} className="w-[9vw] text-[6.5vw]" />
                <span className="animate-pop font-display text-[10vw] leading-none">{count[cup]}</span>
              </div>
              <div className="flex flex-wrap justify-center gap-[0.7vw]">
                {fans.map((id, i) => (
                  <Chip key={id} view={view} id={id} cup={cup} delay={i * 150} />
                ))}
              </div>
              {winner === cup && <p className="mt-auto animate-pop font-display text-[2.4vw] text-stem">👑 Still alive</p>}
            </Panel>
          );
        })}
      </div>
      {tie && (
        <p className="flex items-center justify-center gap-[1vw] text-[2vw] font-bold">
          <span className="inline-block animate-coin">🪙</span> Commissioner, break the tie.
        </p>
      )}
    </div>
  );
}

// ---------- clearing ----------

function Clearing({ view, cur }: { view: View; cur: CurrentView }) {
  const clearing = cur.clearing;
  const crashed = !!clearing && CUPS.some((cup) => clearing.cups[cup].crash);
  useEffect(() => {
    if (crashed) {
      sfx.siren();
      const timer = setTimeout(() => sfx.trombone(), 1600);
      return () => clearTimeout(timer);
    }
    sfx.kaching();
  }, [crashed]);
  if (!clearing) return null;

  return (
    <div className="flex h-full flex-col gap-[2vh]">
      <h1 className={`text-center font-display text-[4vw] leading-none ${crashed ? "animate-shake text-blood" : "text-rind"}`}>
        {crashed ? "💥 Market crash 💥" : "The market clears"}
      </h1>
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-[2vw]">
        {CUPS.map((cup) => {
          const res = clearing.cups[cup];
          return (
            <Panel key={cup} className={`flex flex-col gap-[1.5vh] ${res.won ? "border-stem" : "border-blood/60"}`}>
              <div className="flex items-center gap-[1.5vw]">
                <CupTile cup={cup} className="w-[6vw] shrink-0 text-[4.2vw]" />
                <div className="min-w-0">
                  <p className={`font-display text-[1.5vw] ${res.won ? "text-stem" : "text-blood"}`}>
                    {res.won ? "👑 Advances" : "🪦 Eliminated"}
                  </p>
                  <p className="animate-flipin font-display text-[2.8vw] leading-[1.05]">
                    {drinkName(view, res.drinkId)}
                  </p>
                </div>
              </div>
              <p className="text-[1.5vw] font-semibold text-cream/70">
                {res.crash
                  ? "Nobody bought it, so the whole Market splits it:"
                  : res.owners.length === 1
                    ? `Sole owner drinks ${res.won ? "the spoils" : "the swill"}:`
                    : `${res.owners.length} owners split ${res.won ? "the spoils" : "the swill"}:`}
              </p>
              <div className="flex flex-col gap-[0.6vw] overflow-hidden">
                {res.owners.map((id, i) => {
                  const p = playerOf(view, id);
                  const kind = clearing.verdicts[id];
                  return (
                    <div
                      key={id}
                      style={{ animationDelay: `${600 + i * 200}ms` }}
                      className="flex animate-rise items-center gap-[1vw] rounded-[1vw] bg-ink px-[1.2vw] py-[0.6vw] text-[1.7vw] font-bold"
                    >
                      <span>{p.avatar}</span>
                      <span className="min-w-0 flex-1 truncate">
                        {p.name}
                        {!res.crash && kind && VERDICT_ICON[kind] && (
                          <span className="ml-[0.8vw] text-[1.2vw] font-semibold uppercase tracking-wider text-cream/60">
                            {VERDICT_ICON[kind]} {VERDICT[kind].title}
                          </span>
                        )}
                      </span>
                      <span className="text-[1.3vw] text-cream/60">{ounces(res.poolOz === null ? null : res.poolOz / res.owners.length)}</span>
                      <span className={`font-display ${res.won ? "text-stem" : "text-blood"}`}>{share(res.owners.length)}</span>
                    </div>
                  );
                })}
                {res.owners.length === 0 && (
                  <p className="text-[1.6vw] text-cream/60">No Market Party tonight. Commissioner drinks it.</p>
                )}
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}

// ---------- champion ----------

function Award({ view, title, icon, pick }: { view: View; title: string; icon: string; pick: (s: Stat) => number }) {
  const best = [...view.stats].sort((a, b) => pick(b) - pick(a))[0];
  if (!best || pick(best) <= 0) return null;
  const p = playerOf(view, best.id);
  return (
    <Panel className="animate-rise text-center">
      <p className="text-[3vw] leading-none">{icon}</p>
      <p className="mt-[0.4vw] font-display text-[1.2vw] text-rind">{title}</p>
      <p className="text-[1.7vw] font-bold">
        {p.avatar} {p.name}
      </p>
    </Panel>
  );
}

function Champion({ view }: { view: View }) {
  useEffect(() => {
    sfx.fanfare();
    const colors = ["#ff7a18", "#ffb648", "#a970ff", "#9be15d"];
    burst(colors, 260);
    let shots = 0;
    const timer = setInterval(() => {
      burst(colors, 120);
      if (++shots >= 8) clearInterval(timer);
    }, 1400);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="grid h-full grid-cols-[1.5fr_1fr] gap-[2vw]">
      <div className="flex flex-col items-center justify-center gap-[2vh] text-center">
        <p className="animate-wobble text-[12vw] leading-none">🏆</p>
        <p className="font-display text-[2vw] tracking-[0.3em] text-rind">League champion</p>
        <h1 className="animate-slam font-display text-[6.5vw] leading-[0.95] text-pulp drop-shadow-[0_0.5vw_0_#7a3300]">
          {drinkName(view, view.champion)}
        </h1>
        <div className="mt-[1vh] grid w-full grid-cols-4 gap-[1vw]">
          <Award view={view} title="Wolf of Gourd Street" icon="🐺" pick={(s) => s.genius} />
          <Award view={view} title="Chief Bag Officer" icon="💼" pick={(s) => s.bags} />
          <Award view={view} title="Golden Palate" icon="👅" pick={(s) => s.palate} />
          <Award view={view} title="Drank the Most Swill" icon="🤢" pick={(s) => s.bad} />
        </div>
      </div>
      <div className="flex min-h-0 flex-col gap-[1.5vh]">
        <Panel>
          <p className="mb-[0.8vw] font-display text-[1.6vw] text-rind">Final Pumpkin Index</p>
          <Leaderboard view={view} limit={8} />
        </Panel>
        <Panel className="min-h-0 flex-1">
          <Bracket view={view} className="text-[0.85vw]" />
        </Panel>
      </div>
    </div>
  );
}
