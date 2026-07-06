/**
 * Migration from schema version 0.6.0 to 0.7.0.
 *
 * Moves flat metadata keys ``annotation_<id>`` into
 * ``metadata.annotations.<id>``.
 */

const ANNOTATION_KEY_PATTERN = /^annotation_(.+)$/;

export function migrate(doc: Record<string, any>): Record<string, any> {
  const metadata = { ...(doc.metadata ?? {}) };
  const existing = metadata.annotations;
  const annotations: Record<string, any> =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...existing }
      : {};

  for (const [key, value] of Object.entries(metadata)) {
    const match = ANNOTATION_KEY_PATTERN.exec(key);
    if (!match) {
      continue;
    }

    let annotation = value;
    if (typeof annotation === 'string') {
      try {
        annotation = JSON.parse(annotation);
      } catch {
        continue;
      }
    }

    annotations[match[1]] = annotation;
  }

  return {
    ...doc,
    metadata: {
      annotations,
    },
  };
}
