import { Redis } from "@upstash/redis";
import { newGame } from "./game";
import type { Cup, GameState, Player, Snapshot } from "./types";

export interface Store {
  persistent: boolean;
  snapshot(fresh?: boolean): Promise<Snapshot>;
  setState(state: GameState): Promise<void>;
  setPlayer(player: Player): Promise<void>;
  removePlayer(id: string): Promise<void>;
  setVote(matchupId: string, playerId: string, cup: Cup): Promise<void>;
  clearVotes(): Promise<void>;
  clearPlayers(): Promise<void>;
}

const voteKey = (matchupId: string, playerId: string) => `${matchupId}|${playerId}`;

// ---------- in-memory (local dev only: lost on restart, not shared across instances) ----------

type Memory = { state: GameState; players: Map<string, Player>; votes: Map<string, Cup> };

class MemoryStore implements Store {
  persistent = false;
  private get mem(): Memory {
    const g = globalThis as typeof globalThis & { __npl?: Memory };
    return (g.__npl ??= { state: newGame(), players: new Map(), votes: new Map() });
  }
  async snapshot() {
    return structuredClone({
      state: this.mem.state,
      players: [...this.mem.players.values()],
      votes: Object.fromEntries(this.mem.votes),
    });
  }
  async setState(state: GameState) {
    this.mem.state = structuredClone(state);
  }
  async setPlayer(player: Player) {
    this.mem.players.set(player.id, player);
  }
  async removePlayer(id: string) {
    this.mem.players.delete(id);
  }
  async setVote(matchupId: string, playerId: string, cup: Cup) {
    this.mem.votes.set(voteKey(matchupId, playerId), cup);
  }
  async clearVotes() {
    this.mem.votes.clear();
  }
  async clearPlayers() {
    this.mem.players.clear();
  }
}

// ---------- Upstash Redis ----------

const KEY = { state: "npl:state", players: "npl:players", votes: "npl:votes" };

/** Every screen polls once a second; this keeps that to a couple of Redis reads per second. */
const CACHE_MS = 400;

class RedisStore implements Store {
  persistent = true;
  private cache: { at: number; snap: Snapshot } | null = null;
  constructor(private redis: Redis) {}

  async snapshot(fresh = false): Promise<Snapshot> {
    if (!fresh && this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.snap;
    const [stored, players, votes] = await this.redis
      .pipeline()
      .get<GameState>(KEY.state)
      .hgetall<Record<string, Player>>(KEY.players)
      .hgetall<Record<string, Cup>>(KEY.votes)
      .exec();
    const snap: Snapshot = {
      state: stored ?? (await this.firstGame()),
      players: Object.values(players ?? {}),
      votes: votes ?? {},
    };
    this.cache = { at: Date.now(), snap };
    return snap;
  }
  /** Saves the very first game so every instance agrees on its code. */
  private async firstGame(): Promise<GameState> {
    const fresh = newGame();
    const created = await this.redis.set(KEY.state, fresh, { nx: true });
    return created ? fresh : ((await this.redis.get<GameState>(KEY.state)) ?? fresh);
  }
  // Players and ballots live in hashes so concurrent phones never overwrite each
  // other; only the host writes the state blob.
  async setState(state: GameState) {
    this.cache = null;
    await this.redis.set(KEY.state, state);
  }
  async setPlayer(player: Player) {
    this.cache = null;
    await this.redis.hset(KEY.players, { [player.id]: player });
  }
  async removePlayer(id: string) {
    this.cache = null;
    await this.redis.hdel(KEY.players, id);
  }
  async setVote(matchupId: string, playerId: string, cup: Cup) {
    this.cache = null;
    await this.redis.hset(KEY.votes, { [voteKey(matchupId, playerId)]: cup });
  }
  async clearVotes() {
    this.cache = null;
    await this.redis.del(KEY.votes);
  }
  async clearPlayers() {
    this.cache = null;
    await this.redis.del(KEY.players);
  }
}

let store: Store | null = null;

export function getStore(): Store {
  if (store) return store;
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  store = url && token ? new RedisStore(new Redis({ url, token })) : new MemoryStore();
  return store;
}
