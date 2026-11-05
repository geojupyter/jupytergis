/**
 * Migration from schema version 0.7.0 to 0.7.1.
 *
 * Drops `useProxy` from the sources: whether a request goes through the CORS
 * proxy is now worked out per domain at runtime.
 */

export function migrate(doc: Record<string, any>): Record<string, any> {
  const sources: Record<string, any> = { ...doc.sources };

  for (const [id, source] of Object.entries(sources)) {
    const params = source?.parameters;
    if (!params || typeof params !== 'object' || !('useProxy' in params)) {
      continue;
    }

    const { useProxy: _, ...rest } = params;
    sources[id] = { ...source, parameters: rest };
  }

  return { ...doc, sources };
}
