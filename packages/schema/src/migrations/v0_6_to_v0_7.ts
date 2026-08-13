/**
 * Migration from schema version 0.6.0 to 0.7.0.
 *
 * Renames StorySegmentLayer content.title → imageCaption.
 */

export function migrate(doc: Record<string, any>): Record<string, any> {
  const layers: Record<string, any> = { ...doc.layers };

  for (const [id, layer] of Object.entries(layers)) {
    if (layer?.type !== 'StorySegmentLayer') {
      continue;
    }

    const parameters = layer.parameters;
    const content = parameters?.content;

    if (
      !content ||
      typeof content !== 'object' ||
      !('title' in content) ||
      content.imageCaption !== undefined
    ) {
      continue;
    }

    const { title, ...rest } = content;

    layers[id] = {
      ...layer,
      parameters: {
        ...parameters,
        content: {
          ...rest,
          imageCaption: title ?? '',
        },
      },
    };
  }

  return { ...doc, layers };
}
