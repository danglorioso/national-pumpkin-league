# National Pumpkin League

A live party game for blind-tasting a bracket of pumpkin drinks. Phones are the
buzzers, the TV is the scoreboard, and the host runs it from a remote.

## The game

Each matchup splits the room in two, and the halves swap every matchup.

- **Market Party** sees the cans but can't taste. Each player secretly buys cup A or B.
- **Taste Party** tastes blind and picks the cup they'd keep drinking. Majority advances.
- Then the market clears: the leftover of each drink is split among the Market
  players who bought it. Fewer owners means a bigger share.
- If nobody bought a drink, that's a **Market Crash** and the whole Market Party splits it.

Leftover pools are sized in standard drinks, so a share of a 9% beer is a
smaller pour than a share of a 4.5% one.

## Screens

| Path     | Who                 | What                                              |
| -------- | ------------------- | ------------------------------------------------- |
| `/`      | Players (phones)    | Join, see your party, buy or pick, get your tab   |
| `/tv`    | The room            | QR code, bracket, live lock-ins, reveals, champion |
| `/admin` | Host (PIN required) | Enter drinks, advance each step, break ties       |

A matchup moves through: on deck → voting → market reveal → taste verdict →
market cleared. The big button on `/admin` always does the next step.

## Running it

```bash
pnpm install
pnpm dev
```

Open `/tv` on the big screen and `/admin` on the host's phone. Phones need to
be on the same Wi-Fi; in dev the TV's QR code points at this machine's LAN
address automatically.

## Configuration

Copy `.env.example` to `.env.local`.

- `HOST_PIN` protects `/admin`. Defaults to `1031` if unset, so set it before
  putting this on the internet.
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (or the
  `KV_REST_API_URL` / `KV_REST_API_TOKEN` pair that Vercel's Upstash
  integration provides) turn on the Redis store.

Without Redis, game state lives in the server process's memory. That is fine
for `pnpm dev` on one laptop and will not work on a serverless deploy, where
requests land on different instances.

## Layout

- `src/lib/game.ts`: bracket, party rotation, clearing math, per-role views
- `src/lib/store.ts`: in-memory and Redis storage
- `src/app/api/*`: `state` (polled every second), `join`, `vote`, `admin`
- `src/app/page.tsx`, `src/app/tv/page.tsx`, `src/app/admin/page.tsx`: the three screens
