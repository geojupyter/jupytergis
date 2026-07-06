import type {
  IDrawDefaultAttribute,
  IDrawDefaultAttributePresets,
} from './interfaces';

export const DRAW_DEFAULT_ATTRIBUTE_PRESETS_METADATA_KEY =
  'drawDefaultAttributePresets';

type IDrawDefaultAttributePresetEntry = Record<string, string>;

function parsePresetAttributeEntry(
  entry: unknown,
): IDrawDefaultAttribute | null {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return null;
  }

  const pairs = Object.entries(entry).filter(
    ([key, value]) => typeof key === 'string' && typeof value === 'string',
  );

  if (pairs.length !== 1) {
    return null;
  }

  const [key, value] = pairs[0];
  return { key, value };
}

function serializePresetAttributes(
  attributes: IDrawDefaultAttribute[],
): IDrawDefaultAttributePresetEntry[] {
  return attributes.map(attribute => ({ [attribute.key]: attribute.value }));
}

export function parseDrawDefaultAttributePresets(
  raw: string | undefined,
): IDrawDefaultAttributePresets {
  if (!raw) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    const presets: IDrawDefaultAttributePresets = {};

    for (const [name, attributes] of Object.entries(parsed)) {
      if (!Array.isArray(attributes) || attributes.length === 0) {
        continue;
      }

      const normalized = attributes
        .map(parsePresetAttributeEntry)
        .filter((attribute): attribute is IDrawDefaultAttribute => !!attribute);

      if (normalized.length === 0) {
        continue;
      }

      presets[name] = normalized;
    }

    return presets;
  } catch {
    return {};
  }
}

export function serializeDrawDefaultAttributePresets(
  presets: IDrawDefaultAttributePresets,
): string {
  const serialized: Record<string, IDrawDefaultAttributePresetEntry[]> = {};

  for (const [name, attributes] of Object.entries(presets)) {
    serialized[name] = serializePresetAttributes(attributes);
  }

  return JSON.stringify(serialized);
}
