/**
 * openEO's `load_collection` requires `spatial_extent` to be a full bbox
 * (west/south/east/north) or `null` — an empty `{}` is invalid and gets
 * rejected by validation. We ignore spatial_extent for the tiled layers we
 * render anyway, so normalize an empty extent to `null` (which the schema
 * accepts) rather than blocking the user on an otherwise-valid graph.
 * Returns the graph unchanged (same reference) when there is nothing to fix.
 */
export function normalizeSpatialExtent(
  graph: Record<string, any>,
): Record<string, any> {
  let changed = false;
  const out: Record<string, any> = {};
  for (const [nodeId, node] of Object.entries(graph)) {
    const ext = node?.arguments?.spatial_extent;
    const isEmptyObject =
      ext &&
      typeof ext === 'object' &&
      !Array.isArray(ext) &&
      Object.keys(ext).length === 0;
    if (isEmptyObject) {
      changed = true;
      out[nodeId] = {
        ...node,
        arguments: { ...node.arguments, spatial_extent: null },
      };
    } else {
      out[nodeId] = node;
    }
  }
  return changed ? out : graph;
}

/**
 * XYZ tiling needs the graph to end in `save_result`. ESA User-Defined
 * Processes omit it so they can be extended, so synthesize one over the
 * result node (PNG) when absent. Returns the graph unchanged when a
 * `save_result` is already present or there's no result node to wire onto.
 */
export function ensureSaveResult(
  graph: Record<string, any>,
  format = 'PNG',
): Record<string, any> {
  const entries = Object.entries(graph);
  const hasSaveResult = entries.some(
    ([, node]) => node?.process_id === 'save_result',
  );
  if (hasSaveResult) {
    return graph;
  }
  const resultEntry = entries.find(([, node]) => node?.result === true);
  if (!resultEntry) {
    return graph;
  }
  const [resultNodeId, resultNode] = resultEntry;
  // Mint a non-colliding key.
  const existing = new Set(Object.keys(graph));
  let key = 'saveresult1';
  let n = 1;
  while (existing.has(key)) {
    key = `saveresult${++n}`;
  }
  const { result: _, ...demotedNode } = resultNode;
  return {
    ...graph,
    [resultNodeId]: demotedNode,
    [key]: {
      arguments: {
        data: { from_node: resultNodeId },
        format,
        options: {},
      },
      process_id: 'save_result',
      result: true,
    },
  };
}
