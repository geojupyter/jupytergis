/**
 * JupyterGIS document migration runner.
 *
 * Each step in STEPS is a { from, to, migrate } record where `migrate` takes
 * a parsed document object and returns a new object. Steps must be listed in
 * order and form a contiguous chain.
 */

import { migrate as migrateV0_5ToV0_6 } from './v0_5_to_v0_6';
import { SCHEMA_VERSION } from '../_interface/version';

interface IMigrationStep {
  from: string;
  to: string;
  migrate: (doc: Record<string, any>) => Record<string, any>;
}

const STEPS: IMigrationStep[] = [
  { from: '0.5.0', to: '0.6.0', migrate: migrateV0_5ToV0_6 },
];

const DEFAULT_OVERLAY_CONTENT_WIDTH = '100%';
const DEFAULT_MAP_PANEL_WIDTH = '25%';

function isUnsetWidth(width: unknown): boolean {
  return typeof width !== 'string' || width.trim() === '';
}

/**
 * Load-time story defaults (no schema bump):
 *  - unguided → guided
 *  - overlayContentWidth → 100%
 *  - map segment panelWidth → 25%
 */
function _normalizeStoryOverlays(
  doc: Record<string, unknown>,
): Record<string, unknown> {
  const stories = doc.stories;
  if (!stories || typeof stories !== 'object') {
    return doc;
  }

  let changed = false;
  const nextStories: Record<string, unknown> = {};

  for (const [id, story] of Object.entries(stories)) {
    if (!story || typeof story !== 'object') {
      nextStories[id] = story;
      continue;
    }

    const current = story as Record<string, unknown>;
    let nextStory = current;

    if (current.storyType === 'unguided') {
      nextStory = { ...nextStory, storyType: 'guided' };
      changed = true;
    }

    if (isUnsetWidth(nextStory.overlayContentWidth)) {
      nextStory = {
        ...nextStory,
        overlayContentWidth: DEFAULT_OVERLAY_CONTENT_WIDTH,
      };
      changed = true;
    }

    nextStories[id] = nextStory;
  }

  return changed ? { ...doc, stories: nextStories } : doc;
}

function _normalizeMapPanelWidths(
  doc: Record<string, unknown>,
): Record<string, unknown> {
  const layers = doc.layers;
  if (!layers || typeof layers !== 'object') {
    return doc;
  }

  let changed = false;
  const nextLayers: Record<string, unknown> = {};

  for (const [id, layer] of Object.entries(layers)) {
    if (
      !layer ||
      typeof layer !== 'object' ||
      (layer as { type?: string }).type !== 'StorySegmentLayer'
    ) {
      nextLayers[id] = layer;
      continue;
    }

    const parameters = (layer as { parameters?: Record<string, unknown> })
      .parameters;
    const content = parameters?.content;
    if (!content || typeof content !== 'object') {
      nextLayers[id] = layer;
      continue;
    }

    const mode =
      (content as { contentMode?: string }).contentMode ?? 'map';
    if (
      mode !== 'map' ||
      !isUnsetWidth((content as { panelWidth?: unknown }).panelWidth)
    ) {
      nextLayers[id] = layer;
      continue;
    }

    nextLayers[id] = {
      ...layer,
      parameters: {
        ...parameters,
        content: {
          ...content,
          panelWidth: DEFAULT_MAP_PANEL_WIDTH,
        },
      },
    };
    changed = true;
  }

  return changed ? { ...doc, layers: nextLayers } : doc;
}

/**
 * Apply all necessary migration steps to bring *doc* up to *toVersion*.
 *
 * @param doc - Parsed jGIS document object.
 * @param toVersion - Target schema version. Defaults to the current
 *   SCHEMA_VERSION if omitted.
 * @throws If the document's version is newer than the current schema version.
 */
export function migrateDocument(
  doc: Record<string, any>,
  toVersion?: string,
): Record<string, any> {
  const target = toVersion ?? SCHEMA_VERSION;
  const fileVersion: string = doc.schemaVersion ?? '0.5.0';

  if (_compareVersions(fileVersion, SCHEMA_VERSION) > 0) {
    throw new Error(
      `Cannot load file with schema version ${fileVersion} (current: ${SCHEMA_VERSION})`,
    );
  }

  let current = fileVersion;
  let result = { ...doc };

  for (const step of STEPS) {
    if (
      _compareVersions(current, step.to) < 0 &&
      _compareVersions(step.to, target) <= 0
    ) {
      result = step.migrate(result);
      result.schemaVersion = step.to;
      current = step.to;
    }
  }

  for (const step of [_normalizeStoryOverlays, _normalizeMapPanelWidths]) {
    result = step(result);
  }

  return result;
}

/** Simple semver comparison: returns negative, 0, or positive. */
function _compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}
