export type SfxKey =
  | "bombPlace"
  | "bombExplode"
  | "crateBreak"
  | "flames"
  | "matchStart"
  | "roundEnd"
  | "matchWin"
  | "powerCollect"
  | "shieldBlock"
  | "suddenDeathAlarm";

export interface SoundDefinition {
  readonly url: string;
  readonly volume: number;
}

export type SoundManifestEntry = SoundDefinition | readonly SoundDefinition[];
export type SoundManifest = Readonly<Partial<Record<SfxKey, SoundManifestEntry>>>;

export interface SoundPort {
  setVolume(volume: number): void;
  getVolume(): number;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
  loadSounds(manifest: SoundManifest): Promise<void>;
  bindUnlock(target: EventTarget): void;
  playOneShot(key: SfxKey, gain?: number): void;
}

export const AUDIO_VOLUME_STORAGE_KEY = "bomba-audio-volume";
export const AUDIO_MUTED_STORAGE_KEY = "bomba-audio-muted";

/** Server/test default. It preserves settings semantics without browser audio. */
export function createNoopSoundPort(): SoundPort {
  let volume = 0.7;
  let muted = false;
  return {
    setVolume(nextVolume) {
      volume = Math.max(0, Math.min(1, nextVolume));
    },
    getVolume: () => volume,
    setMuted(nextMuted) {
      muted = nextMuted;
    },
    isMuted: () => muted,
    loadSounds: async () => undefined,
    bindUnlock: () => undefined,
    playOneShot: () => undefined,
  };
}
