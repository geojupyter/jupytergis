import type { IDrawDefaultAttribute } from '@jupytergis/schema';

const RESERVED_DRAW_ATTRIBUTE_KEYS = new Set([
  '_id',
  '_createdAt',
  '_creatorClientId',
  '_fromDrawTool',
  'geometry',
  '_geometry',
]);

export const DRAW_DEFAULT_ATTRIBUTE_FALLBACK = {
  key: 'Label',
  value: 'New Label',
} as const;

export function normalizeDrawAttributeKey(key: string): string {
  return key.trim();
}

export function isReservedDrawAttributeKey(key: string): boolean {
  return RESERVED_DRAW_ATTRIBUTE_KEYS.has(normalizeDrawAttributeKey(key));
}

export function validateDrawAttributeKey(
  key: string,
  existingKeys: string[] = [],
): { valid: boolean; error?: string } {
  const normalized = normalizeDrawAttributeKey(key);

  if (!normalized) {
    return { valid: false, error: 'Key is required.' };
  }

  if (isReservedDrawAttributeKey(normalized)) {
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

export function applyDrawDefaultAttributesToFeature(
  feature: { set: (key: string, value: unknown) => void },
  attributes: IDrawDefaultAttribute[],
): void {
  if (attributes.length === 0) {
    feature.set(
      DRAW_DEFAULT_ATTRIBUTE_FALLBACK.key,
      DRAW_DEFAULT_ATTRIBUTE_FALLBACK.value,
    );
    return;
  }

  for (const attribute of attributes) {
    feature.set(attribute.key, attribute.value);
  }
}
