"use client";

import { useState } from "react";
import { SWITCH_MS } from "@/lib/game";
import type { Cup } from "@/lib/types";

/** Fraction of the countdown at which the coin has landed (matches the keyframes). */
export const COIN_LANDS = 0.82;

const FACE: Record<Cup, string> = {
  A: "bg-pulp",
  B: "bg-hex [transform:rotateX(180deg)]",
};

/**
 * A tossed coin that lands on `cup` shortly before the countdown ends. The
 * parent sets its size (`size-*`) and the letter size (`text-*`).
 */
export function CoinFlip({ cup, remaining, className = "" }: { cup: Cup; remaining: number; className?: string }) {
  // A screen that heard about the flip late starts part-way through, so every
  // coin in the room lands at the same moment.
  const [elapsed] = useState(() => SWITCH_MS - remaining);
  const timing = { animationDuration: `${SWITCH_MS}ms`, animationDelay: `${-elapsed}ms` };
  // Five full turns, plus half a turn to finish on the B side.
  const end = { "--coin-end": `${cup === "A" ? 1800 : 1980}deg` } as React.CSSProperties;

  return (
    <div className={`animate-coin-toss [perspective:1400px] ${className}`} style={timing}>
      <div className="relative size-full animate-coin-spin [transform-style:preserve-3d]" style={{ ...timing, ...end }}>
        {(["A", "B"] as Cup[]).map((side) => (
          <span
            key={side}
            className={`absolute inset-0 grid place-items-center rounded-full border-[0.07em] border-rind font-display leading-none text-ink shadow-[inset_0_0_0_0.05em_rgba(0,0,0,0.25)] [backface-visibility:hidden] ${FACE[side]}`}
          >
            {side}
          </span>
        ))}
      </div>
    </div>
  );
}
