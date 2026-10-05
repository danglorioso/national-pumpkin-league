"use client";

import { useState } from "react";

export function PinGate({
  icon,
  title,
  wrong,
  onSubmit,
}: {
  icon: string;
  title: string;
  wrong: boolean;
  onSubmit: (pin: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSubmit(value.trim());
      }}
      className="m-auto flex w-full max-w-xs flex-col gap-4 px-4 text-center"
    >
      <p className="text-6xl">{icon}</p>
      <h1 className="font-display text-2xl text-rind">{title}</h1>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        type="password"
        inputMode="numeric"
        autoFocus
        placeholder="Host PIN"
        className="rounded-2xl border-2 border-bark bg-soil px-4 py-3 text-center text-2xl font-bold outline-none focus:border-pulp"
      />
      {wrong && <p className="text-blood">Wrong PIN.</p>}
      <button className="rounded-2xl bg-pulp px-4 py-3 font-bold text-ink transition active:translate-y-0.5">
        Enter
      </button>
    </form>
  );
}
