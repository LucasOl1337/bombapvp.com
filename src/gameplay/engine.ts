import { getBotDecision } from "./bot-ai.ts";
import {
  BOMB_FUSE_MS,
  BOT_THINK_INTERVAL_MS,
  FLAME_DURATION_MS,
  MOVE_INTERVAL_MS,
  blastTiles,
  createInitialGameState,
  isWalkable,
  moveTile,
  sameTile,
  tileKey,
  type ArenaPlayer,
  type Direction,
  type GameState,
  type PlayerId,
} from "./model.ts";

export class BotTrainingGame {
  private state = createInitialGameState();
  private humanDirection: Direction | null = null;
  private botThinkRemainingMs = 0;
  private nextBombId = 1;

  public getSnapshot(): GameState {
    return this.state;
  }

  public setHumanDirection(direction: Direction | null): void {
    this.humanDirection = direction;
  }

  public moveHuman(direction: Direction): void {
    if (this.state.status !== "playing") return;
    const human = this.state.players.find((player) => player.kind === "human");
    if (human) this.movePlayer(human, direction);
  }

  public placeBomb(playerId: PlayerId = 1): boolean {
    if (this.state.status !== "playing") return false;
    const player = this.player(playerId);
    if (
      !player?.alive ||
      player.activeBombs >= 1 ||
      player.bombCooldownMs > 0 ||
      this.state.bombs.some((bomb) => sameTile(bomb.tile, player.tile))
    ) {
      return false;
    }
    this.state.bombs.push({
      id: this.nextBombId,
      ownerId: player.id,
      tile: { ...player.tile },
      fuseMs: BOMB_FUSE_MS,
      radius: 2,
    });
    this.nextBombId += 1;
    player.activeBombs += 1;
    player.bombCooldownMs = 520;
    return true;
  }

  public restart(): void {
    this.state = createInitialGameState();
    this.humanDirection = null;
    this.botThinkRemainingMs = 0;
    this.nextBombId = 1;
  }

  public advance(deltaMs: number): void {
    if (this.state.status !== "playing") return;
    const elapsed = Math.max(0, Math.min(deltaMs, 250));
    this.state.elapsedMs += elapsed;

    for (const player of this.state.players) {
      player.moveCooldownMs = Math.max(0, player.moveCooldownMs - elapsed);
      player.bombCooldownMs = Math.max(0, player.bombCooldownMs - elapsed);
    }
    this.state.flames = this.state.flames
      .map((flame) => ({ ...flame, remainingMs: flame.remainingMs - elapsed }))
      .filter((flame) => flame.remainingMs > 0);

    const human = this.state.players.find((player) => player.kind === "human");
    if (human && this.humanDirection) this.movePlayer(human, this.humanDirection);

    this.botThinkRemainingMs -= elapsed;
    if (this.botThinkRemainingMs <= 0) {
      this.botThinkRemainingMs = BOT_THINK_INTERVAL_MS;
      for (const bot of this.state.players.filter((player) => player.kind === "bot" && player.alive)) {
        const decision = getBotDecision(this.state, bot);
        if (decision.placeBomb) this.placeBomb(bot.id);
        if (decision.direction) this.movePlayer(bot, decision.direction);
      }
    }

    for (const bomb of this.state.bombs) bomb.fuseMs -= elapsed;
    this.resolveExplosions();
    this.resolveFlameHits();
    this.resolveRound();
  }

  private player(playerId: PlayerId): ArenaPlayer | undefined {
    return this.state.players.find((player) => player.id === playerId);
  }

  private movePlayer(player: ArenaPlayer, direction: Direction): void {
    if (!player.alive || player.moveCooldownMs > 0) return;
    const next = moveTile(player.tile, direction);
    if (!isWalkable(this.state, next)) return;
    player.tile = next;
    player.moveCooldownMs = MOVE_INTERVAL_MS;
  }

  private resolveExplosions(): void {
    const pending = this.state.bombs.filter((bomb) => bomb.fuseMs <= 0).map((bomb) => bomb.id);
    const exploded = new Set<number>();

    while (pending.length > 0) {
      const bombId = pending.shift();
      if (bombId === undefined || exploded.has(bombId)) continue;
      const bomb = this.state.bombs.find((candidate) => candidate.id === bombId);
      if (!bomb) continue;
      exploded.add(bomb.id);
      const tiles = blastTiles(this.state, bomb.tile, bomb.radius);

      for (const tile of tiles) {
        const existingFlame = this.state.flames.find((flame) => sameTile(flame.tile, tile));
        if (existingFlame) existingFlame.remainingMs = FLAME_DURATION_MS;
        else this.state.flames.push({ tile: { ...tile }, remainingMs: FLAME_DURATION_MS });
        this.state.crates.delete(tileKey(tile));
        for (const chained of this.state.bombs) {
          if (!exploded.has(chained.id) && sameTile(chained.tile, tile)) pending.push(chained.id);
        }
      }
    }

    if (exploded.size === 0) return;
    for (const bomb of this.state.bombs) {
      if (!exploded.has(bomb.id)) continue;
      const owner = this.player(bomb.ownerId);
      if (owner) owner.activeBombs = Math.max(0, owner.activeBombs - 1);
    }
    this.state.bombs = this.state.bombs.filter((bomb) => !exploded.has(bomb.id));
  }

  private resolveFlameHits(): void {
    for (const player of this.state.players) {
      if (player.alive && this.state.flames.some((flame) => sameTile(flame.tile, player.tile))) {
        player.alive = false;
      }
    }
  }

  private resolveRound(): void {
    const alive = this.state.players.filter((player) => player.alive);
    if (alive.length > 1) return;
    const humanAlive = alive.some((player) => player.kind === "human");
    this.state.status = alive.length === 0 ? "draw" : humanAlive ? "won" : "lost";
    this.humanDirection = null;
  }
}

export type { Direction, GameState, PlayerId } from "./model.ts";
