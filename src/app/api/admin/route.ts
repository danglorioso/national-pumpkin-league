import {
  buildBracket,
  closeVoting,
  currentMatchup,
  liveVotes,
  newGame,
  restage,
  settle,
  shuffled,
  stageNext,
  tally,
} from "@/lib/game";
import { fail, isHost, json } from "@/lib/server";
import { getStore } from "@/lib/store";
import type { Drink, Phase } from "@/lib/types";

type Body = {
  action?: string;
  title?: unknown;
  poolStd?: unknown;
  drinks?: unknown;
  shuffle?: unknown;
  cup?: unknown;
  id?: unknown;
  wipe?: unknown;
};

/** What the big "advance" button does from each phase. */
const NEXT: Record<Phase, string | null> = {
  lobby: "start",
  bracket: "open",
  voting: "close",
  market: "revealTaste",
  taste: "clear",
  clearing: "next",
  champion: null,
};

function parseDrinks(input: unknown): Drink[] {
  if (!Array.isArray(input)) return [];
  const drinks: Drink[] = [];
  for (const raw of input.slice(0, 32)) {
    const name = String(raw?.name ?? "").trim().slice(0, 40);
    if (!name) continue;
    const abv = Number(raw?.abv);
    drinks.push({
      id: `d${drinks.length}`,
      name,
      abv: Number.isFinite(abv) && abv >= 0.5 && abv <= 80 ? abv : null,
      seed: drinks.length + 1,
    });
  }
  return drinks;
}

export async function POST(req: Request) {
  if (!isHost(req)) return fail("Wrong host PIN", 401);
  const body = (await req.json().catch(() => ({}))) as Body;

  const store = getStore();
  const snap = await store.snapshot(true);
  const state = structuredClone(snap.state);
  const { players } = snap;
  const m = currentMatchup(state);
  const action = body.action === "advance" ? NEXT[state.phase] : body.action;

  switch (action) {
    case "setup": {
      if (state.phase !== "lobby") return fail("Tournament already started");
      if (typeof body.title === "string" && body.title.trim()) {
        state.title = body.title.trim().slice(0, 40);
      }
      const poolStd = Number(body.poolStd);
      if (Number.isFinite(poolStd) && poolStd > 0 && poolStd <= 3) state.poolStd = poolStd;
      if (body.drinks !== undefined) state.drinks = parseDrinks(body.drinks);
      break;
    }
    case "start": {
      if (state.phase !== "lobby") return fail("Tournament already started");
      if (state.drinks.length < 2) return fail("Need at least 2 drinks");
      if (body.shuffle !== false) {
        state.drinks = shuffled(state.drinks).map((d, i) => ({ ...d, seed: i + 1 }));
      }
      state.rounds = buildBracket(state.drinks);
      state.matchNumber = 0;
      stageNext(state, players);
      state.phase = "bracket";
      await store.clearVotes();
      break;
    }
    case "reshuffle": {
      if (state.phase !== "bracket") return fail("Parties are locked once voting opens");
      state.rotation++;
      restage(state, players);
      break;
    }
    case "open": {
      if (state.phase !== "bracket" || !m) return fail("Nothing on deck");
      await store.clearVotes();
      state.phase = "voting";
      break;
    }
    case "close": {
      if (state.phase !== "voting" || !m) return fail("Voting isn't open");
      closeVoting(m, liveVotes(snap, m));
      state.phase = "market";
      break;
    }
    case "reopen": {
      if (state.phase !== "market") return fail("Too late to reopen");
      state.phase = "voting";
      break;
    }
    case "revealTaste": {
      if (state.phase !== "market" || !m?.played) return fail("Reveal the market first");
      const t = tally(m.played.picks);
      if (t.A !== t.B) {
        m.played.winnerCup = t.A > t.B ? "A" : "B";
        m.played.decidedBy = "taste";
      }
      state.phase = "taste";
      break;
    }
    case "tiebreak": {
      if (state.phase !== "taste" || !m?.played) return fail("No tie to break");
      if (m.played.decidedBy === "taste") return fail("The tasters already decided");
      if (body.cup === "coin") {
        m.played.winnerCup = Math.random() < 0.5 ? "A" : "B";
        m.played.decidedBy = "coin";
      } else if (body.cup === "A" || body.cup === "B") {
        m.played.winnerCup = body.cup;
        m.played.decidedBy = "host";
      } else return fail("Pick A, B or coin");
      break;
    }
    case "clear": {
      if (state.phase !== "taste" || !m?.played) return fail("Reveal the taste vote first");
      if (!m.played.winnerCup) return fail("It's a tie. Break it first");
      settle(state, m);
      state.phase = "clearing";
      break;
    }
    case "next": {
      if (state.phase !== "clearing") return fail("Clear the market first");
      state.matchNumber++;
      state.phase = stageNext(state, players) ? "bracket" : "champion";
      break;
    }
    case "kick": {
      await store.removePlayer(String(body.id));
      break;
    }
    case "reset": {
      const fresh = newGame();
      if (body.wipe === true) {
        await store.clearPlayers();
      } else {
        fresh.title = state.title;
        fresh.poolStd = state.poolStd;
        fresh.drinks = [...state.drinks]
          .sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }))
          .map((d, i) => ({ ...d, seed: i + 1 }));
      }
      fresh.version = state.version;
      Object.assign(state, fresh);
      await store.clearVotes();
      break;
    }
    default:
      return fail(action ? `Unknown action: ${action}` : "Nothing left to advance");
  }

  state.version++;
  await store.setState(state);
  return json({ ok: true, phase: state.phase });
}
