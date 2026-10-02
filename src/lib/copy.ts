import type { VerdictKind } from "./types";

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

export const QUIPS = [
  "Half look. Half taste. Everybody drinks.",
  "Fewer owners = bigger share.",
  "Nobody owns it = everybody owns it.",
  "Past pumpkin performance does not guarantee future results.",
  "The market can stay irrational longer than you can stay sober.",
  "Buy the rumor. Drink the news.",
  "This league is not regulated by the SEC, the FDA, or anyone's mother.",
  "A fancy label is not a personality.",
  "Be greedy when others are fearful of the nutmeg.",
  "Diversification is impossible. You get one cup.",
  "Cinnamon is not a substitute for flavor.",
  "Remember: somebody has to finish it.",
];
