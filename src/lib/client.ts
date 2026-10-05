"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Role, View } from "./types";

const POLL_MS = 1000;

// ---------- server clock ----------

// Countdowns run on the server's clock so every screen hits zero together.
// Each poll gives a sample; the one with the fastest round trip is the most
// accurate, so keep that until it goes stale.
let clock = { offset: 0, rtt: Infinity, at: 0 };

function noteServerTime(serverNow: number, sent: number, received: number) {
  const rtt = received - sent;
  if (rtt <= clock.rtt || received - clock.at > 15_000) {
    clock = { offset: serverNow + rtt / 2 - received, rtt, at: received };
  }
}

export function serverNow(): number {
  return Date.now() + clock.offset;
}

/** Milliseconds until server time `at`; re-renders ~10×/s until it reaches zero. */
export function useCountdown(at: number): number {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (at <= serverNow()) return;
    const timer = setInterval(() => {
      setTick((t) => t + 1);
      if (at <= serverNow()) clearInterval(timer);
    }, 100);
    return () => clearInterval(timer);
  }, [at]);
  return Math.max(0, at - serverNow());
}

export type Creds = { id: string; secret: string };

type Auth = { creds?: Creds | null; pin?: string | null };

function headers({ creds, pin }: Auth): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(creds ? { "x-player": `${creds.id}:${creds.secret}` } : {}),
    ...(pin ? { "x-host-pin": pin } : {}),
  };
}

/** POSTs to the game API. Never throws: failures come back as `error`. */
export async function post<T = unknown>(
  path: string,
  body: unknown,
  auth: Auth = {},
): Promise<{ data: T | null; error: string | null; status: number }> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: headers(auth),
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return { data: null, error: data?.error ?? `Request failed (${res.status})`, status: res.status };
    }
    return { data, error: null, status: res.status };
  } catch {
    return { data: null, error: "Can't reach the league office", status: 0 };
  }
}

export function useGame(role: Role, auth: Auth = {}, enabled = true) {
  const [view, setView] = useState<View | null>(null);
  const [status, setStatus] = useState<"ok" | "denied" | "offline">("ok");
  const seq = useRef(0);
  const applied = useRef(0);
  const { creds, pin } = auth;
  const id = creds?.id;
  const secret = creds?.secret;

  const refresh = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const sent = Date.now();
      const res = await fetch(`/api/state?role=${role}`, {
        cache: "no-store",
        headers: headers({ creds: id && secret ? { id, secret } : null, pin }),
      });
      if (mine < applied.current) return;
      applied.current = mine;
      if (res.status === 401) return setStatus("denied");
      if (!res.ok) return setStatus("offline");
      const next: View = await res.json();
      noteServerTime(next.now, sent, Date.now());
      setView(next);
      setStatus("ok");
    } catch {
      setStatus("offline");
    }
  }, [role, id, secret, pin]);

  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    tick();
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [enabled, refresh]);

  return { view, status, refresh };
}

// ---------- localStorage-backed state ----------

const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function useStored<T>(key: string): [T | null, (value: T | null) => void] {
  const raw = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(key),
    () => null,
  );
  const value = useMemo(() => {
    try {
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }, [raw]);
  const set = useCallback(
    (next: T | null) => {
      if (next === null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(next));
      listeners.forEach((l) => l());
    },
    [key],
  );
  return [value, set];
}

const noop = () => () => {};

/** False during SSR and hydration, true once browser-only state is readable. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

// ---------- lookups ----------

export function drinkName(view: View, id: string | null | undefined): string {
  return view.drinks.find((d) => d.id === id)?.name ?? "???";
}

export function playerOf(view: View, id: string) {
  return view.players.find((p) => p.id === id) ?? { id, name: "Ghost", avatar: "👻", joinedAt: 0 };
}
