import { CHAMPION_MEMBERSHIP, type ChampionSlug } from "../../../../Champions/membership.ts";
import type {
  BombSnapshot,
  CompetitorId,
  Direction,
  GameCommand,
  GameSnapshot,
  TileCoord,
} from "../../contracts.ts";
import { DIRECTION_DELTA } from "../../kernel/world-state.ts";
import type {
  ActiveTechnique,
  TacticalSituation,
  TechniqueCandidate,
  TechniquePredicate,
  TechniqueSelection,
} from "./contracts.ts";

export type RuntimeTechnique = ActiveTechnique | TechniqueCandidate;

function key(tile: TileCoord): string {
  return `${tile.x},${tile.y}`;
}

function wrap(snapshot: GameSnapshot, tile: TileCoord): TileCoord {
  return Object.freeze({
    x: ((tile.x % snapshot.arena.width) + snapshot.arena.width) % snapshot.arena.width,
    y: ((tile.y % snapshot.arena.height) + snapshot.arena.height) % snapshot.arena.height,
  });
}

function manhattan(left: TileCoord, right: TileCoord): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

function chebyshev(left: TileCoord, right: TileCoord): number {
  return Math.max(Math.abs(left.x - right.x), Math.abs(left.y - right.y));
}

function blastTiles(snapshot: GameSnapshot, bomb: BombSnapshot): readonly TileCoord[] {
  const solid = new Set(snapshot.arena.solid.map(key));
  const crates = new Set(snapshot.arena.crates.map(key));
  const tiles: TileCoord[] = [bomb.tile];
  for (const direction of ["up", "down", "left", "right"] as const) {
    const delta = DIRECTION_DELTA[direction];
    for (let distance = 1; distance <= bomb.flameRange; distance += 1) {
      const tile = { x: bomb.tile.x + delta.x * distance, y: bomb.tile.y + delta.y * distance };
      if (
        tile.x < 0
        || tile.y < 0
        || tile.x >= snapshot.arena.width
        || tile.y >= snapshot.arena.height
      ) break;
      const tileKey = key(tile);
      if (solid.has(tileKey)) break;
      tiles.push(Object.freeze(tile));
      if (crates.has(tileKey)) break;
    }
  }
  return Object.freeze(tiles);
}

function selfInDanger(snapshot: GameSnapshot, selfTile: TileCoord): boolean {
  const ownKey = key(selfTile);
  if (snapshot.flames.some((flame) => key(flame.tile) === ownKey)) return true;
  if (snapshot.pressure.closing && key(snapshot.pressure.closing.tile) === ownKey) return true;
  return snapshot.bombs.some((bomb) => blastTiles(snapshot, bomb).some((tile) => key(tile) === ownKey));
}

function opponents(snapshot: GameSnapshot, competitorId: CompetitorId) {
  return snapshot.competitors.filter(
    (competitor) => competitor.id !== competitorId && competitor.alive,
  );
}

function alignedOpponentDistance(
  snapshot: GameSnapshot,
  competitorId: CompetitorId,
): number | null {
  const self = snapshot.competitors.find((competitor) => competitor.id === competitorId);
  if (!self) return null;
  const opponentTiles = new Set(opponents(snapshot, competitorId).map((opponent) => key(opponent.tile)));
  const blocked = new Set([
    ...snapshot.arena.solid.map(key),
    ...snapshot.arena.crates.map(key),
  ]);
  let best: number | null = null;
  const maximum = Math.max(snapshot.arena.width, snapshot.arena.height) - 1;
  for (const direction of ["up", "down", "left", "right"] as const) {
    const delta = DIRECTION_DELTA[direction];
    let tile = self.tile;
    for (let distance = 1; distance <= maximum; distance += 1) {
      tile = wrap(snapshot, { x: tile.x + delta.x, y: tile.y + delta.y });
      const tileKey = key(tile);
      if (blocked.has(tileKey)) break;
      if (opponentTiles.has(tileKey)) {
        best = best === null ? distance : Math.min(best, distance);
        break;
      }
      if (tile.x === self.tile.x && tile.y === self.tile.y) break;
    }
  }
  return best;
}

export function projectTacticalSituation(
  snapshot: GameSnapshot,
  competitorId: CompetitorId,
): TacticalSituation | null {
  const self = snapshot.competitors.find((competitor) => competitor.id === competitorId);
  if (!self) return null;
  const nearest = opponents(snapshot, competitorId)
    .map((opponent) => manhattan(self.tile, opponent.tile))
    .sort((left, right) => left - right)[0] ?? null;
  return Object.freeze({
    phase: snapshot.phase,
    revision: snapshot.revision,
    selfTile: Object.freeze({ ...self.tile }),
    selfInDanger: selfInDanger(snapshot, self.tile),
    nearestOpponentDistance: nearest,
    alignedOpponentDistance: alignedOpponentDistance(snapshot, competitorId),
    skillPhase: self.skill?.phase ?? "unassigned",
  });
}

function matchesPredicate(
  predicate: TechniquePredicate,
  situation: TacticalSituation,
  snapshot: GameSnapshot,
  competitorId: CompetitorId,
): boolean {
  if (predicate.kind === "self-in-danger") return situation.selfInDanger;
  if (predicate.kind === "opponent-aligned") {
    return situation.alignedOpponentDistance !== null
      && situation.alignedOpponentDistance <= predicate.maxTiles;
  }
  const self = snapshot.competitors.find((competitor) => competitor.id === competitorId);
  if (!self) return false;
  return opponents(snapshot, competitorId).some(
    (opponent) => chebyshev(self.tile, opponent.tile) <= predicate.radius,
  );
}

function priority(technique: RuntimeTechnique): number {
  return technique.status === "active" ? technique.score.priority : technique.proposedPriority;
}

function confidence(technique: RuntimeTechnique, evaluationEpoch: number): number {
  return technique.status === "active"
    ? decayedTechniqueConfidence(technique, evaluationEpoch)
    : 0;
}

function utility(technique: RuntimeTechnique): number {
  return technique.status === "active" ? technique.score.utilityBasisPoints : 0;
}

export function decayedTechniqueConfidence(
  technique: ActiveTechnique,
  evaluationEpoch: number,
): number {
  const elapsed = Math.max(0, Math.trunc(evaluationEpoch) - technique.score.evaluationEpoch);
  return Math.max(
    technique.score.floorBasisPoints,
    technique.score.confidenceBasisPoints - elapsed * technique.score.decayPerEpochBasisPoints,
  );
}

/**
 * Closed declarative interpreter. It accepts data only and can emit only an
 * existing GameCommand; no callbacks, expressions, or executable strings are
 * part of the technique schema.
 */
export function selectTechnique(
  snapshot: GameSnapshot,
  competitorId: CompetitorId,
  championSlug: ChampionSlug,
  techniques: readonly RuntimeTechnique[],
  baseCommands: readonly GameCommand[],
  evaluationEpoch = 1,
): TechniqueSelection | null {
  const situation = projectTacticalSituation(snapshot, competitorId);
  if (!situation) return null;
  const expected = CHAMPION_MEMBERSHIP[championSlug];
  const matching = techniques
    .filter((technique) =>
      technique.compatibility.championSlug === championSlug
      && technique.compatibility.characterId === expected.characterId
      && technique.compatibility.skillId === expected.skillId
      && technique.condition.all.every((predicate) =>
        matchesPredicate(predicate, situation, snapshot, competitorId)))
    .sort((left, right) =>
      priority(right) - priority(left)
      || confidence(right, evaluationEpoch) - confidence(left, evaluationEpoch)
      || utility(right) - utility(left)
      || left.id.localeCompare(right.id));
  const eligibleTechniqueIds = Object.freeze(matching.map(({ id }) => id));
  const canUseSkill = situation.skillPhase === "idle"
    && (snapshot.phase === "playing" || snapshot.phase === "sudden-death")
    && !baseCommands.some((command) => command.type === "use-skill");
  const selected = canUseSkill ? matching[0] ?? null : null;
  return Object.freeze({
    situation,
    eligibleTechniqueIds,
    selectedTechniqueId: selected?.id ?? null,
    additionalCommands: selected
      ? Object.freeze([{ type: "use-skill" as const, competitorId }])
      : Object.freeze([]),
  });
}
