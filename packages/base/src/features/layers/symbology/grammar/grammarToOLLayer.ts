/**
 * Grammar → OL layer compiler.
 *
 * grammarToOLLayer compiles an IGrammarSymbologyState into a single OL layer:
 *
 *   • one non-KDE grammar layer  → VectorImageLayer
 *   • one KDE grammar layer      → HeatmapLayer
 *   • multiple grammar layers    → LayerGroup containing the above
 *
 * All multi-layer and transform decisions are encapsulated here; callers
 * treat the result as an opaque OL Layer.
 */

import {
  IEncodingRule,
  IGrammarLayer,
  IGrammarSymbologyState,
  IKDETransform,
} from '@jupytergis/schema';
import {
  Heatmap as HeatmapLayer,
  Layer,
  VectorImage as VectorImageLayer,
} from 'ol/layer';
import LayerGroup from 'ol/layer/Group';
import { Vector as VectorSource } from 'ol/source';
import { Rule } from 'ol/style/flat';

import { getColorMap } from '../colorRampUtils';
import { grammarToOLStyle } from './grammarToOLStyle';

// Default OL heatmap gradient (cool → warm).
const DEFAULT_GRADIENT = ['#00f', '#0ff', '#0f0', '#ff0', '#f00'];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compile a Grammar symbology state into a single OL layer.
 * When the state contains multiple grammar layers a LayerGroup is returned;
 * otherwise the appropriate single layer type is returned directly.
 */
export function grammarToOLLayer(
  state: IGrammarSymbologyState,
  source: VectorSource,
  opacity: number,
  visible: boolean,
  featureValues: unknown[] = [],
): Layer | LayerGroup {
  const subLayers = state.layers.map(grammarLayer =>
    compileGrammarLayer(grammarLayer, source, opacity, visible, featureValues),
  );

  if (subLayers.length === 1) {
    return subLayers[0];
  }

  return new LayerGroup({ opacity, visible, layers: subLayers });
}

// ---------------------------------------------------------------------------
// Per grammar-layer compilation
// ---------------------------------------------------------------------------

function compileGrammarLayer(
  grammarLayer: IGrammarLayer,
  source: VectorSource,
  opacity: number,
  visible: boolean,
  featureValues: unknown[],
): VectorImageLayer | HeatmapLayer {
  const kdeTransform = grammarLayer.preprocess?.find(
    (t): t is IKDETransform => t.type === 'kde',
  );

  if (kdeTransform) {
    return compileKDELayer(
      grammarLayer,
      kdeTransform,
      source,
      opacity,
      visible,
    );
  }

  return compileVectorLayer(
    grammarLayer,
    source,
    opacity,
    visible,
    featureValues,
  );
}

// ---------------------------------------------------------------------------
// KDE → HeatmapLayer
// ---------------------------------------------------------------------------

function compileKDELayer(
  grammarLayer: IGrammarLayer,
  kdeTransform: IKDETransform,
  source: VectorSource,
  opacity: number,
  visible: boolean,
): HeatmapLayer {
  const gradient = extractGradient(grammarLayer.rules) ?? DEFAULT_GRADIENT;
  const { weightField } = kdeTransform;

  return new HeatmapLayer({
    opacity,
    visible,
    source,
    blur: kdeTransform.blur ?? 15,
    radius: kdeTransform.radius ?? 10,
    gradient,
    ...(weightField
      ? {
          weight: (feature: any) => {
            const val = feature.get(weightField);
            return typeof val === 'number' && isFinite(val) ? val : 1;
          },
        }
      : {}),
  });
}

/**
 * Look for a pixel-color colorRamp mapping in the rules and convert it to an
 * OL HeatmapLayer gradient string array.  Returns undefined when absent.
 */
function extractGradient(rules: IEncodingRule[]): string[] | undefined {
  for (const rule of rules) {
    for (const mapping of rule.mappings) {
      const isPixelChannel = (mapping.channels as string[]).some(
        ch => ch === 'pixel-color' || ch.startsWith('pixel-'),
      );
      if (!isPixelChannel || mapping.scale.scheme !== 'colorRamp') {
        continue;
      }

      const colorMap = getColorMap(mapping.scale.params.name as any);
      if (!colorMap || colorMap.colors.length === 0) {
        continue;
      }

      // Sample 5 evenly spaced stops from the 255-entry color array.
      const n = 5;
      const colors = colorMap.colors;
      const step = (colors.length - 1) / (n - 1);
      const gradient = Array.from(
        { length: n },
        (_, i) => colors[Math.round(i * step)],
      );
      return mapping.scale.params.reverse ? [...gradient].reverse() : gradient;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Non-KDE → VectorImageLayer
// ---------------------------------------------------------------------------

function compileVectorLayer(
  grammarLayer: IGrammarLayer,
  source: VectorSource,
  opacity: number,
  visible: boolean,
  featureValues: unknown[],
): VectorImageLayer {
  const singleLayerState: IGrammarSymbologyState = {
    renderType: 'Grammar',
    layers: [grammarLayer],
  };
  const flatStyle = grammarToOLStyle(singleLayerState, featureValues);
  const rule: Rule = { style: flatStyle };

  return new VectorImageLayer({ opacity, visible, source, style: [rule] });
}
