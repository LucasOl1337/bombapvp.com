import {
  ONLINE_PROTOCOL_VERSION,
  type PlayerCommand,
} from "./contracts";

export const PLAYER_COMMAND_PACKET_TYPE = 0x01;
export const PLAYER_COMMAND_PACKET_BYTES = 16;
export const MAX_CLIENT_GAMEPLAY_PACKET_BYTES = 64;

const DIRECTION_MASK = 0b0000_0111;
const BOMB_PRESSED = 0b0000_1000;
const DETONATE_PRESSED = 0b0001_0000;
const SKILL_PRESSED = 0b0010_0000;
const SKILL_HELD = 0b0100_0000;
const RESERVED_FLAG = 0b1000_0000;

const DIRECTION_TO_CODE = Object.freeze({
  up: 1,
  right: 2,
  down: 3,
  left: 4,
} as const);

const CODE_TO_DIRECTION = Object.freeze({
  1: "up",
  2: "right",
  3: "down",
  4: "left",
} as const);

export type PlayerCommandDecodeError =
  | "packet-too-large"
  | "invalid-length"
  | "invalid-packet-type"
  | "unsupported-protocol-version"
  | "reserved-bit-set"
  | "invalid-direction";

export type PlayerCommandDecodeResult =
  | Readonly<{ ok: true; command: PlayerCommand }>
  | Readonly<{ ok: false; code: PlayerCommandDecodeError }>;

export function encodePlayerCommand(command: PlayerCommand): Uint8Array {
  assertUint32(command.seq, "seq");
  assertUint32(command.clientTick, "clientTick");
  assertUint32(command.lastServerTick, "lastServerTick");

  const packet = new Uint8Array(PLAYER_COMMAND_PACKET_BYTES);
  packet[0] = PLAYER_COMMAND_PACKET_TYPE;
  packet[1] = ONLINE_PROTOCOL_VERSION;
  packet[2] = encodeFlags(command);
  packet[3] = 0;

  const view = new DataView(packet.buffer);
  view.setUint32(4, command.seq, true);
  view.setUint32(8, command.clientTick, true);
  view.setUint32(12, command.lastServerTick, true);
  return packet;
}

export function decodePlayerCommand(packet: Uint8Array): PlayerCommandDecodeResult {
  if (packet.byteLength > MAX_CLIENT_GAMEPLAY_PACKET_BYTES) {
    return { ok: false, code: "packet-too-large" };
  }
  if (packet.byteLength !== PLAYER_COMMAND_PACKET_BYTES) {
    return { ok: false, code: "invalid-length" };
  }
  if (packet[0] !== PLAYER_COMMAND_PACKET_TYPE) {
    return { ok: false, code: "invalid-packet-type" };
  }
  if (packet[1] !== ONLINE_PROTOCOL_VERSION) {
    return { ok: false, code: "unsupported-protocol-version" };
  }

  const flags = packet[2] ?? 0;
  if ((flags & RESERVED_FLAG) !== 0 || packet[3] !== 0) {
    return { ok: false, code: "reserved-bit-set" };
  }
  const directionCode = flags & DIRECTION_MASK;
  if (directionCode > 4) {
    return { ok: false, code: "invalid-direction" };
  }

  const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength);
  return {
    ok: true,
    command: {
      seq: view.getUint32(4, true),
      clientTick: view.getUint32(8, true),
      lastServerTick: view.getUint32(12, true),
      direction: directionCode === 0
        ? null
        : CODE_TO_DIRECTION[directionCode as keyof typeof CODE_TO_DIRECTION],
      bombPressed: (flags & BOMB_PRESSED) !== 0,
      detonatePressed: (flags & DETONATE_PRESSED) !== 0,
      skillPressed: (flags & SKILL_PRESSED) !== 0,
      skillHeld: (flags & SKILL_HELD) !== 0,
    },
  };
}

function encodeFlags(command: PlayerCommand): number {
  const direction = command.direction === null ? 0 : DIRECTION_TO_CODE[command.direction];
  return direction
    | (command.bombPressed ? BOMB_PRESSED : 0)
    | (command.detonatePressed ? DETONATE_PRESSED : 0)
    | (command.skillPressed ? SKILL_PRESSED : 0)
    | (command.skillHeld ? SKILL_HELD : 0);
}

function assertUint32(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff) {
    throw new RangeError(`${field} must be an unsigned 32-bit integer`);
  }
}
