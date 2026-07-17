/** Recursively freezes a plain catalog graph so readonly contracts also hold at runtime. */
export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  const record = value as unknown as Record<PropertyKey, unknown>;
  for (const key of Reflect.ownKeys(record)) {
    deepFreeze(record[key]);
  }
  return Object.freeze(value);
}
