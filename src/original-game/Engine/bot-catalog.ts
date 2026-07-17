export const LOCAL_BOT_IDS = ["bomb", "pingo", "v1", "v2", "v3"] as const;

export type LocalBotId = (typeof LOCAL_BOT_IDS)[number];

export type LocalBotMetadata = Readonly<{
  id: LocalBotId;
  model: `bot-${LocalBotId}`;
  label: string;
}>;

export const DEFAULT_TRAINING_BOT_ID: LocalBotId = "bomb";
export const DEFAULT_CONTINUOUS_BOT_ID: LocalBotId = "v1";

export const LOCAL_BOT_CATALOG: readonly LocalBotMetadata[] = Object.freeze([
  { id: "bomb", model: "bot-bomb", label: "Bomb" },
  { id: "pingo", model: "bot-pingo", label: "Pingo" },
  { id: "v1", model: "bot-v1", label: "V1" },
  { id: "v2", model: "bot-v2", label: "V2" },
  { id: "v3", model: "bot-v3", label: "V3" },
] satisfies readonly LocalBotMetadata[]);

export function getLocalBotMetadataById(id: string | null | undefined): LocalBotMetadata | null {
  const normalizedId = id?.trim();
  return LOCAL_BOT_CATALOG.find((bot) => bot.id === normalizedId) ?? null;
}

export function getLocalBotMetadataByModel(model: string | null | undefined): LocalBotMetadata | null {
  const normalizedModel = model?.trim();
  return LOCAL_BOT_CATALOG.find((bot) => bot.model === normalizedModel) ?? null;
}
