import type { IDrawCustomProperty } from '@jupytergis/schema';

const RESERVED_DRAW_CUSTOM_PROPERTY_KEYS = new Set([
  '_id',
  '_createdAt',
  '_creatorClientId',
  '_fromDrawTool',
  'geometry',
  '_geometry',
]);

export function normalizeDrawCustomPropertyKey(key: string): string {
  return key.trim();
}

export function isReservedDrawCustomPropertyKey(key: string): boolean {
  return RESERVED_DRAW_CUSTOM_PROPERTY_KEYS.has(
    normalizeDrawCustomPropertyKey(key),
  );
}

export function validateDrawCustomPropertyKey(
  key: string,
  existingKeys: string[] = [],
): { valid: boolean; error?: string } {
  const normalized = normalizeDrawCustomPropertyKey(key);

  if (!normalized) {
    return { valid: false, error: 'Key is required.' };
  }

  if (isReservedDrawCustomPropertyKey(normalized)) {
    return {
      valid: false,
      error: `"${normalized}" is a reserved property name.`,
    };
  }

  if (existingKeys.includes(normalized)) {
    return {
      valid: false,
      error: `Property "${normalized}" already exists.`,
    };
  }

  return { valid: true };
}

export function validatePresetName(name: string): {
  valid: boolean;
  error?: string;
} {
  if (!name.trim()) {
    return { valid: false, error: 'Preset name is required.' };
  }

  return { valid: true };
}

export function applyDrawCustomPropertiesToFeature(
  feature: { set: (key: string, value: unknown) => void },
  properties: IDrawCustomProperty[],
): void {
  for (const property of properties) {
    feature.set(property.key, property.value);
  }
}
