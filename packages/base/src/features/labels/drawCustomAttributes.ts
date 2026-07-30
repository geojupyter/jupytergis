import type { IDrawCustomAttribute } from '@jupytergis/schema';

const RESERVED_DRAW_CUSTOM_ATTRIBUTE_KEYS = new Set([
  '_id',
  '_createdAt',
  '_creatorClientId',
  '_fromDrawTool',
  'geometry',
  '_geometry',
]);

export function normalizeDrawCustomAttributeKey(key: string): string {
  return key.trim();
}

export function isReservedDrawCustomAttributeKey(key: string): boolean {
  return RESERVED_DRAW_CUSTOM_ATTRIBUTE_KEYS.has(
    normalizeDrawCustomAttributeKey(key),
  );
}

export function validateDrawCustomAttributeKey(
  key: string,
  existingKeys: string[] = [],
): { valid: boolean; error?: string } {
  const normalized = normalizeDrawCustomAttributeKey(key);

  if (!normalized) {
    return { valid: false, error: 'Key is required.' };
  }

  if (isReservedDrawCustomAttributeKey(normalized)) {
    return {
      valid: false,
      error: `"${normalized}" is a reserved attribute name.`,
    };
  }

  if (existingKeys.includes(normalized)) {
    return {
      valid: false,
      error: `Attribute "${normalized}" already exists.`,
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

export function applyDrawCustomAttributesToFeature(
  feature: { set: (key: string, value: unknown) => void },
  attributes: IDrawCustomAttribute[],
): void {
  for (const attribute of attributes) {
    feature.set(attribute.key, attribute.value);
  }
}
