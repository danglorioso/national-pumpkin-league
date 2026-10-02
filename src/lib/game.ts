import {
  PHASES,
  type Clearing,
  type Cup,
  type CupResult,
  type CurrentView,
  type Drink,
  type GameState,
  type Matchup,
  type Party,
  type Phase,
  type Player,
  type Pour,
  type Role,
  type Snapshot,
  type Stat,
  type VerdictKind,
  type View,
} from "./types";

export const CUPS: Cup[] = ["A", "B"];

const AVATARS = [
  "🎃", "👻", "🦇", "🕷️", "🧙", "🧛", "🧟", "💀", "🍂", "🌽",
  "🦉", "🐈‍⬛", "🍁", "🥧", "🕸️", "🦝", "🍄", "🐺", "🧌", "🪦",
];

/** US standard drink: 0.6 fl oz of ethanol. */
const ETHANOL_OZ_PER_STD = 0.6;
const MAX_POOL_OZ = 12;

export function newGame(): GameState {
  return {
    version: 1,
    phase: "lobby",
    title: "National Pumpkin League",
    drinks: [],
    rounds: [],
    currentId: null,
    matchNumber: 0,
    rotation: 0,
    poolStd: 1,
    seed: Math.floor(Math.random() * 1e9),
  };
}

export function pickAvatar(players: Player[]): string {
  const used = new Set(players.map((p) => p.avatar));
  const free = AVATARS.filter((a) => !used.has(a));
  const pool = free.length ? free : AVATARS;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ---------- seeded randomness (party rotation must be reproducible) ----------

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffled<T>(items: T[], rand: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------- bracket ----------

function seedOrder(size: number): number[] {
  let order = [0];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((s) => [s, n - 1 - s]);
  }
  return order;
}

function propagate(rounds: Matchup[][], m: Matchup) {
  const next = rounds[m.round + 1]?.[m.slot >> 1];
  if (!next) return;
  if (m.slot % 2 === 0) next.top = m.winner;
  else next.bottom = m.winner;
}

export function buildBracket(drinks: Drink[]): Matchup[][] {
  let size = 2;
  while (size < drinks.length) size *= 2;
  const order = seedOrder(size);
  const rounds: Matchup[][] = [];
  for (let r = 0, n = size / 2; n >= 1; r++, n /= 2) {
    rounds.push(
      Array.from({ length: n }, (_, slot) => ({
        id: `r${r}m${slot}`,
        round: r,
        slot,
        top: null,
        bottom: null,
        flip: false,
        winner: null,
        bye: false,
        played: null,
      })),
    );
  }
  rounds[0].forEach((m, i) => {
    m.top = drinks[order[2 * i]]?.id ?? null;
    m.bottom = drinks[order[2 * i + 1]]?.id ?? null;
  });
  for (const m of rounds[0]) {
    if (m.top && m.bottom) continue;
    m.bye = true;
    m.winner = m.top ?? m.bottom;
    propagate(rounds, m);
  }
  return rounds;
}

export function roundName(matchupsInRound: number): string {
  if (matchupsInRound === 1) return "The Pumpkin Bowl";
  if (matchupsInRound === 2) return "Final Pour";
  if (matchupsInRound === 4) return "Elite Eight-Pack";
  if (matchupsInRound === 8) return "Sweet Sixteen-Ounce";
  return `Round of ${matchupsInRound * 2}`;
}

export function currentMatchup(state: GameState): Matchup | null {
  if (!state.currentId) return null;
  for (const round of state.rounds) {
    const m = round.find((x) => x.id === state.currentId);
    if (m) return m;
  }
  return null;
}

export function cupDrink(m: Matchup, cup: Cup): string {
  const first = m.flip ? m.bottom : m.top;
  const second = m.flip ? m.top : m.bottom;
  return (cup === "A" ? first : second) as string;
}

// ---------- matchup lifecycle ----------

/**
 * Parties reshuffle every two matchups and swap in between, so each player
 * looks once and tastes once with the same crew before the room is remixed.
 */
function assignParties(state: GameState, players: Player[]) {
  const ids = [...players].sort((a, b) => a.joinedAt - b.joinedAt).map((p) => p.id);
  const pair = Math.floor(state.matchNumber / 2);
  const order = shuffled(ids, rng(hash(`${state.seed}:${pair}:${state.rotation}`)));
  const swap = state.matchNumber % 2 === 1;
  const market: string[] = [];
  const taste: string[] = [];
  order.forEach((id, i) => ((i % 2 === 0) !== swap ? market : taste).push(id));
  return { market, taste };
}

/** Puts the next undecided matchup on deck. Returns false when the bracket is done. */
export function stageNext(state: GameState, players: Player[]): boolean {
  const next = state.rounds.flat().find((m) => !m.winner && m.top && m.bottom);
  if (!next) {
    state.currentId = null;
    return false;
  }
  state.currentId = next.id;
  restage(state, players);
  return true;
}

export function restage(state: GameState, players: Player[]) {
  const m = currentMatchup(state);
  if (!m) return;
  m.flip = Math.random() < 0.5;
  m.played = {
    ...assignParties(state, players),
    buys: {},
    picks: {},
    winnerCup: null,
    decidedBy: null,
  };
}

export function liveVotes(snap: Snapshot, m: Matchup): Record<string, Cup> {
  const out: Record<string, Cup> = {};
  const prefix = `${m.id}|`;
  for (const [key, cup] of Object.entries(snap.votes)) {
    if (key.startsWith(prefix)) out[key.slice(prefix.length)] = cup;
  }
  return out;
}

/** Freezes live ballots into the matchup record when the host closes voting. */
export function closeVoting(m: Matchup, votes: Record<string, Cup>) {
  const p = m.played;
  if (!p) return;
  p.buys = {};
  p.picks = {};
  for (const id of p.market) if (votes[id]) p.buys[id] = votes[id];
  for (const id of p.taste) if (votes[id]) p.picks[id] = votes[id];
}

export function tally(ballots: Record<string, Cup>): Record<Cup, number> {
  const out = { A: 0, B: 0 };
  for (const cup of Object.values(ballots)) out[cup]++;
  return out;
}

export function settle(state: GameState, m: Matchup) {
  if (!m.played?.winnerCup) return;
  m.winner = cupDrink(m, m.played.winnerCup);
  propagate(state.rounds, m);
}

// ---------- clearing the market ----------

function verdicts(m: Matchup): Record<string, VerdictKind> {
  const p = m.played!;
  const bought = tally(p.buys);
  const out: Record<string, VerdictKind> = {};
  for (const id of p.market) {
    const buy = p.buys[id];
    if (!buy) {
      out[id] = "asleep";
      continue;
    }
    const minority = bought[buy] < bought[buy === "A" ? "B" : "A"];
    const correct = buy === p.winnerCup;
    out[id] = correct ? (minority ? "genius" : "called") : minority ? "bag" : "herd";
  }
  for (const id of p.taste) {
    const pick = p.picks[id];
    out[id] = !pick ? "tonguetied" : pick === p.winnerCup ? "palate" : "outvoted";
  }
  return out;
}

export function computeClearing(state: GameState, m: Matchup): Clearing | null {
  const p = m.played;
  if (!p?.winnerCup) return null;
  const cups = {} as Record<Cup, CupResult>;
  const pours: Pour[] = [];
  for (const cup of CUPS) {
    const drinkId = cupDrink(m, cup);
    const abv = state.drinks.find((d) => d.id === drinkId)?.abv;
    const buyers = p.market.filter((id) => p.buys[id] === cup);
    // Market Crash: nobody bought it, so the whole Market Party splits it.
    const crash = buyers.length === 0;
    const owners = crash ? p.market : buyers;
    const poolOz = abv
      ? Math.min(MAX_POOL_OZ, (state.poolStd * ETHANOL_OZ_PER_STD) / (abv / 100))
      : null;
    const won = cup === p.winnerCup;
    cups[cup] = { cup, drinkId, buyers, owners, crash, poolOz, won };
    for (const playerId of owners) {
      pours.push({
        playerId,
        cup,
        drinkId,
        owners: owners.length,
        oz: poolOz === null ? null : poolOz / owners.length,
        crash,
        good: won,
      });
    }
  }
  return { cups, pours, verdicts: verdicts(m) };
}

const POINTS: Record<VerdictKind, number> = {
  genius: 3,
  called: 1,
  herd: 0,
  bag: -1,
  asleep: 0,
  palate: 1,
  outvoted: 0,
  tonguetied: 0,
};

export function computeStats(state: GameState, players: Player[]): Stat[] {
  const stats = new Map<string, Stat>(
    players.map((p) => [
      p.id,
      { id: p.id, points: 0, genius: 0, bags: 0, palate: 0, sheep: 0, good: 0, bad: 0 },
    ]),
  );
  for (const m of state.rounds.flat()) {
    if (!m.winner || m.bye) continue;
    const clearing = computeClearing(state, m);
    if (!clearing) continue;
    for (const [id, kind] of Object.entries(clearing.verdicts)) {
      const s = stats.get(id);
      if (!s) continue;
      s.points += POINTS[kind];
      if (kind === "genius") s.genius++;
      if (kind === "bag") s.bags++;
      if (kind === "palate") s.palate++;
      if (kind === "called" || kind === "herd") s.sheep++;
    }
    for (const pour of clearing.pours) {
      const s = stats.get(pour.playerId);
      if (!s) continue;
      if (pour.good) s.good += 1 / pour.owners;
      else s.bad += 1 / pour.owners;
    }
  }
  return [...stats.values()].sort((a, b) => b.points - a.points || b.genius - a.genius);
}

// ---------- views ----------

const rank = (phase: Phase) => PHASES.indexOf(phase);

function viewCurrent(
  snap: Snapshot,
  m: Matchup,
  role: Role,
  meId: string | null,
): CurrentView | null {
  const { state } = snap;
  const p = m.played;
  if (!p) return null;
  const at = rank(state.phase);
  const voting = state.phase === "voting";
  const roster = new Set([...p.market, ...p.taste]);
  const ballots = voting ? liveVotes(snap, m) : { ...p.buys, ...p.picks };
  const inMarket = !!meId && p.market.includes(meId);
  // Tasters, spectators and the TV stay blind until the market clears.
  const unmasked = role === "admin" || inMarket || at >= rank("clearing");
  return {
    id: m.id,
    number: state.matchNumber + 1,
    total: Math.max(1, state.drinks.length - 1),
    roundName: roundName(state.rounds[m.round].length),
    top: m.top as string,
    bottom: m.bottom as string,
    market: p.market,
    taste: p.taste,
    locked: Object.keys(ballots).filter((id) => roster.has(id)),
    cups: unmasked ? { A: cupDrink(m, "A"), B: cupDrink(m, "B") } : null,
    buys: at >= rank("market") ? p.buys : null,
    picks: at >= rank("taste") ? p.picks : null,
    winnerCup: at >= rank("taste") ? p.winnerCup : null,
    tie: state.phase === "taste" && !p.winnerCup,
    decidedBy: at >= rank("taste") ? p.decidedBy : null,
    clearing: at >= rank("clearing") ? computeClearing(state, m) : null,
  };
}

export function buildView(
  snap: Snapshot,
  role: Role,
  meId: string | null,
  persistent: boolean,
): View {
  const { state } = snap;
  const players = [...snap.players].sort((a, b) => a.joinedAt - b.joinedAt);
  const m = currentMatchup(state);
  const me = role === "player" ? (players.find((p) => p.id === meId) ?? null) : null;
  const live = state.phase !== "lobby" && state.phase !== "champion";
  const current = m && live ? viewCurrent(snap, m, role, me?.id ?? null) : null;

  let mine: View["me"] = null;
  if (me) {
    const p = m?.played;
    const party: Party = p?.market.includes(me.id)
      ? "market"
      : p?.taste.includes(me.id)
        ? "taste"
        : "spectator";
    const ballots = !m || !p ? {} : state.phase === "voting" ? liveVotes(snap, m) : { ...p.buys, ...p.picks };
    mine = {
      id: me.id,
      name: me.name,
      avatar: me.avatar,
      joinedAt: me.joinedAt,
      party,
      vote: (live && party !== "spectator" && ballots[me.id]) || null,
    };
  }

  const final = state.rounds.at(-1)?.[0];
  return {
    version: state.version,
    phase: state.phase,
    title: state.title,
    players: players.map(({ id, name, avatar, joinedAt }) => ({ id, name, avatar, joinedAt })),
    drinks: state.drinks,
    rounds: state.rounds.map((round) =>
      round.map((x) => {
        let score: [number, number] | null = null;
        if (x.winner && x.played) {
          const t = tally(x.played.picks);
          score = x.flip ? [t.B, t.A] : [t.A, t.B];
        }
        return {
          id: x.id,
          round: x.round,
          slot: x.slot,
          top: x.top,
          bottom: x.bottom,
          winner: x.winner,
          bye: x.bye,
          score,
        };
      }),
    ),
    current,
    me: mine,
    stats: computeStats(state, players),
    champion: state.phase === "champion" ? (final?.winner ?? null) : null,
    poolStd: state.poolStd,
    persistent,
  };
}
