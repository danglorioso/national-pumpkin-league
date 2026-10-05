export type Cup = "A" | "B";
export type Role = "player" | "tv" | "admin";
export type Party = "market" | "taste" | "spectator";

export const PHASES = [
  "lobby", // players join, host enters drinks
  "bracket", // bracket on TV, next matchup on deck, parties assigned
  "voting", // market buys, tasters pick
  "taste", // taste vote revealed, winner cup known
  "clearing", // cups unmasked, who bought what, pours assigned
  "champion",
] as const;
export type Phase = (typeof PHASES)[number];

/** Which host action kicked off the countdown every screen is showing. */
export type SwitchKind = "start" | "open" | "close" | "reopen" | "tiebreak" | "clear" | "next" | "final";

export type Drink = { id: string; name: string; abv: number | null; seed: number };

export type Player = {
  id: string;
  secret: string;
  name: string;
  avatar: string;
  joinedAt: number;
};
export type PublicPlayer = Omit<Player, "secret">;

export type Played = {
  market: string[];
  taste: string[];
  buys: Record<string, Cup>;
  picks: Record<string, Cup>;
  winnerCup: Cup | null;
  decidedBy: "taste" | "host" | "coin" | null;
};

export type Matchup = {
  id: string;
  round: number;
  slot: number;
  top: string | null;
  bottom: string | null;
  /** Cup A holds `bottom` when true, so bracket position never leaks the cup. */
  flip: boolean;
  winner: string | null;
  bye: boolean;
  played: Played | null;
};

export type GameState = {
  version: number;
  /** Shown on the TV; phones must enter it to join. New one per game. */
  code: string;
  phase: Phase;
  title: string;
  drinks: Drink[];
  rounds: Matchup[][];
  currentId: string | null;
  /** Matchups completed so far; drives party rotation. */
  matchNumber: number;
  rotation: number;
  /** Standard drinks in each leftover pool, used to size pours by ABV. */
  poolStd: number;
  seed: number;
  /**
   * Server time (ms) when the current phase goes live on every screen. The
   * state changes the instant the host taps; screens count down to this.
   */
  switchAt: number;
  switchKind: SwitchKind | null;
};

export type Snapshot = {
  state: GameState;
  players: Player[];
  /** Live ballots keyed `${matchupId}|${playerId}`. */
  votes: Record<string, Cup>;
};

export type VerdictKind =
  | "genius" // bought the winner against the crowd
  | "called" // bought the winner with the crowd
  | "herd" // bought the loser with the crowd
  | "bag" // bought the loser against the crowd
  | "asleep" // market player who never bought
  | "palate" // taster who picked the winner
  | "outvoted" // taster who picked the loser
  | "tonguetied"; // taster who never picked

export type Pour = {
  playerId: string;
  cup: Cup;
  drinkId: string;
  owners: number;
  oz: number | null;
  crash: boolean;
  good: boolean;
};

export type CupResult = {
  cup: Cup;
  drinkId: string;
  buyers: string[];
  owners: string[];
  crash: boolean;
  poolOz: number | null;
  won: boolean;
};

export type Clearing = {
  cups: Record<Cup, CupResult>;
  pours: Pour[];
  verdicts: Record<string, VerdictKind>;
};

export type Stat = {
  id: string;
  points: number;
  genius: number;
  bags: number;
  palate: number;
  sheep: number;
  good: number;
  bad: number;
};

export type ViewMatchup = {
  id: string;
  round: number;
  slot: number;
  top: string | null;
  bottom: string | null;
  winner: string | null;
  bye: boolean;
  /** Taste votes for [top, bottom] once the matchup is settled. */
  score: [number, number] | null;
};

export type CurrentView = {
  id: string;
  number: number;
  total: number;
  roundName: string;
  top: string;
  bottom: string;
  market: string[];
  taste: string[];
  locked: string[];
  /** Cup -> drink id. Null while this viewer must stay blind. */
  cups: Record<Cup, string> | null;
  buys: Record<string, Cup> | null;
  picks: Record<string, Cup> | null;
  winnerCup: Cup | null;
  tie: boolean;
  decidedBy: Played["decidedBy"];
  clearing: Clearing | null;
};

export type View = {
  version: number;
  phase: Phase;
  title: string;
  players: PublicPlayer[];
  drinks: Drink[];
  rounds: ViewMatchup[][];
  current: CurrentView | null;
  me: (PublicPlayer & { party: Party; vote: Cup | null }) | null;
  stats: Stat[];
  champion: string | null;
  poolStd: number;
  /** False when running on the in-memory dev store. */
  persistent: boolean;
  /** Game code, only sent to the TV and the host. */
  code: string | null;
  /** Server clock when this view was built, for syncing countdowns. */
  now: number;
  switchAt: number;
  switchKind: SwitchKind | null;
};
