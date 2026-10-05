import type { SwitchKind, VerdictKind } from "./types";

/** What every screen says while counting down into the next phase. */
export const SWITCH_COPY: Record<SwitchKind, { title: string; line: string }> = {
  start: { title: "Kickoff", line: "The bracket drops in" },
  open: { title: "Voting opens", line: "Market: eyes on the cans. Tasters: cups in hand." },
  close: { title: "Pencils down", line: "The tasters have spoken…" },
  reopen: { title: "Voting reopens", line: "Second chance. Don't waste it." },
  tiebreak: { title: "Breaking the tie", line: "The commissioner has decided…" },
  clear: { title: "Unmasking", line: "Who bought what. Who drinks what." },
  next: { title: "Next matchup", line: "Refill. Regroup. Re-pour." },
  final: { title: "Crowning the champion", line: "One pumpkin to rule them all" },
};

/** Countdowns that build suspense with a drumroll instead of beeps. */
export const DRUMROLL: SwitchKind[] = ["close", "tiebreak", "final"];

export const VERDICT: Record<VerdictKind, { title: string; line: string; tone: "good" | "bad" | "meh" }> = {
  genius: {
    title: "Contrarian Genius",
    line: "You saw what the sheep couldn't. The good stuff is yours.",
    tone: "good",
  },
  called: {
    title: "Safe Money",
    line: "Right call, crowded trade. Enjoy your thimble.",
    tone: "good",
  },
  herd: {
    title: "Herd of Fools",
    line: "You all bought the dud together. Misery loves company.",
    tone: "bad",
  },
  bag: {
    title: "Bag Holder",
    line: "Tried to be clever. Now you own the swill.",
    tone: "bad",
  },
  asleep: {
    title: "Asleep at the Bell",
    line: "Bought nothing. Learned nothing.",
    tone: "meh",
  },
  palate: {
    title: "Golden Palate",
    line: "The room agreed with your tongue.",
    tone: "good",
  },
  outvoted: {
    title: "Outvoted",
    line: "You liked the loser. It's on your record now.",
    tone: "bad",
  },
  tonguetied: {
    title: "Tongue-Tied",
    line: "You had one job and two cups.",
    tone: "meh",
  },
};

export function share(owners: number): string {
  if (owners === 1) return "ALL OF IT";
  if (owners === 2) return "½";
  if (owners === 3) return "⅓";
  if (owners === 4) return "¼";
  return `1/${owners}`;
}

export function ounces(oz: number | null): string {
  if (oz === null) return "";
  return `≈ ${oz >= 10 ? Math.round(oz) : Math.round(oz * 2) / 2} oz`;
}
