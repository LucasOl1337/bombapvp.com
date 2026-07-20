/**
 * Browser sound adapter for the GameMechanics prototype.
 *
 * Pure presentation: consumes kernel GameEvents and plays local audio files.
 * Never touches simulation state; dropping or throttling a sound has no
 * mechanical effect. HTMLAudio with a tiny per-key pool and per-key
 * throttling, mirroring the product sound-manager policies.
 */

import bombPlaceUrl from "../../assets/audio/bombs/bomb_place.mp3";
import bombExplodeMainUrl from "../../assets/audio/bombs/bomb_explode_main.mp3";
import bombExplodeDefaultUrl from "../../assets/audio/bombs/bomb_explode_default.mp3";
import flamesUrl from "../../assets/audio/bombs/flames.mp3";
import crateBreakUrl from "../../assets/audio/gameplay/shield_block_deflect.mp3";
import matchStartUrl from "../../assets/audio/match/match_start.mp3";
import matchWinUrl from "../../assets/audio/match/match_win.mp3";
import roundEndUrl from "../../assets/audio/match/round_end.wav";
import suddenDeathAlarmUrl from "../../assets/audio/match/sudden_death_alarm.wav";
import powerCollectUrl from "../../assets/audio/power-ups/powerup_collect.mp3";
import powerCollectBrightUrl from "../../assets/audio/power-ups/powerup_collect_bright.mp3";
import powerCollectCrystalUrl from "../../assets/audio/power-ups/powerup_collect_crystal.mp3";

import type { GameEvent } from "../contracts.ts";

const MASTER_VOLUME = 0.85;
/** Pool size per key so overlapping blasts don't cut each other off. */
const POOL_SIZE = 3;

type SoundKey =
  | "bombPlace"
  | "bombExplode"
  | "flames"
  | "crateBreak"
  | "powerCollect"
  | "matchStart"
  | "roundEnd"
  | "matchWin"
  | "suddenDeathAlarm";

type SoundDef = Readonly<{
  urls: readonly string[];
  volume: number;
  minIntervalMs: number;
}>;

const SOUND_DEFS: Readonly<Record<SoundKey, SoundDef>> = Object.freeze({
  bombPlace: Object.freeze({ urls: [bombPlaceUrl], volume: 0.9, minIntervalMs: 60 }),
  bombExplode: Object.freeze({
    urls: [bombExplodeMainUrl, bombExplodeDefaultUrl],
    volume: 1,
    minIntervalMs: 90,
  }),
  flames: Object.freeze({ urls: [flamesUrl], volume: 0.55, minIntervalMs: 220 }),
  crateBreak: Object.freeze({ urls: [crateBreakUrl], volume: 0.42, minIntervalMs: 90 }),
  powerCollect: Object.freeze({
    urls: [powerCollectUrl, powerCollectBrightUrl, powerCollectCrystalUrl],
    volume: 0.9,
    minIntervalMs: 120,
  }),
  matchStart: Object.freeze({ urls: [matchStartUrl], volume: 0.9, minIntervalMs: 500 }),
  roundEnd: Object.freeze({ urls: [roundEndUrl], volume: 0.8, minIntervalMs: 500 }),
  matchWin: Object.freeze({ urls: [matchWinUrl], volume: 0.95, minIntervalMs: 500 }),
  suddenDeathAlarm: Object.freeze({ urls: [suddenDeathAlarmUrl], volume: 0.9, minIntervalMs: 1500 }),
});

const pools = new Map<SoundKey, HTMLAudioElement[]>();
const lastPlayedAt = new Map<SoundKey, number>();
const variantCursor = new Map<SoundKey, number>();
let muted = false;
let unlocked = false;

function poolFor(key: SoundKey): HTMLAudioElement[] {
  const existing = pools.get(key);
  if (existing) return existing;
  const def = SOUND_DEFS[key];
  const pool: HTMLAudioElement[] = [];
  for (let i = 0; i < POOL_SIZE; i += 1) {
    const audio = new Audio();
    audio.preload = "auto";
    audio.src = def.urls[0]!;
    pool.push(audio);
  }
  pools.set(key, pool);
  return pool;
}

export function preloadSounds(): void {
  for (const key of Object.keys(SOUND_DEFS) as SoundKey[]) poolFor(key);
}

function play(key: SoundKey, nowMs: number): void {
  if (muted || !unlocked) return;
  const def = SOUND_DEFS[key];
  const last = lastPlayedAt.get(key) ?? -Infinity;
  if (nowMs - last < def.minIntervalMs) return;
  lastPlayedAt.set(key, nowMs);
  const variant = (variantCursor.get(key) ?? 0) % def.urls.length;
  variantCursor.set(key, variant + 1);
  const url = def.urls[variant]!;
  const pool = poolFor(key);
  const voice = pool.find((audio) => audio.paused || audio.ended) ?? pool[0]!;
  try {
    voice.pause();
    voice.src = url;
    voice.currentTime = 0;
    voice.volume = Math.max(0, Math.min(1, def.volume * MASTER_VOLUME));
    void voice.play().catch(() => {
      // Autoplay policies can still reject; presentation-only, so swallow.
    });
  } catch {
    // Presentation-only: a failed sound must never break the frame.
  }
}

/**
 * Audio unlock: browsers gate playback behind a user gesture. The first
 * keydown/pointerdown arms the bank; sounds requested before that are dropped.
 */
export function initSoundUnlock(target: Window): void {
  const arm = () => {
    unlocked = true;
    target.removeEventListener("keydown", arm);
    target.removeEventListener("pointerdown", arm);
  };
  target.addEventListener("keydown", arm);
  target.addEventListener("pointerdown", arm);
}

export function toggleSoundMuted(): boolean {
  muted = !muted;
  if (muted) {
    for (const pool of pools.values()) {
      for (const audio of pool) audio.pause();
    }
  }
  return muted;
}

export function isSoundMuted(): boolean {
  return muted;
}

/** Translate kernel events into one-shot sounds. */
export function playSoundsForEvents(events: readonly GameEvent[], nowMs: number): void {
  for (const event of events) {
    switch (event.type) {
      case "bomb-placed":
        play("bombPlace", nowMs);
        break;
      case "bomb-exploded":
        play("bombExplode", nowMs);
        play("flames", nowMs);
        break;
      case "crate-destroyed":
        play("crateBreak", nowMs);
        break;
      case "power-up-collected":
        play("powerCollect", nowMs);
        break;
      case "sudden-death-started":
        play("suddenDeathAlarm", nowMs);
        break;
      case "round-started":
        if (event.roundNumber === 1) play("matchStart", nowMs);
        break;
      case "round-ended":
        play("roundEnd", nowMs);
        break;
      case "match-ended":
        play("matchWin", nowMs);
        break;
      default:
        break;
    }
  }
}
