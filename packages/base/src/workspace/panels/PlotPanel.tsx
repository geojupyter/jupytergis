/**
 * PlotPanel renders a Vega-Lite chart for each grammar layer that contains
 * plot-* channels. It reads symbologyState from the model's layers and
 * re-renders when layers change.
 */

import { IJupyterGISModel } from '@jupytergis/schema';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import vegaEmbed from 'vega-embed';

import {
  grammarToPlotSpec,
  IVegaLiteSpec,
} from '../../features/layers/symbology/grammarToPlot';

interface IPlotPanelProps {
  model: IJupyterGISModel;
  getData: (layerId: string) => Record<string, unknown>[];
}

interface IPlotCard {
  layerId: string;
  layerName: string;
  grammarLayerId: string;
  spec: IVegaLiteSpec;
  data: Record<string, unknown>[];
}

/**
 * Extract feature property objects from a layer's GeoJSON source.
 * Supports inline GeoJSON data only; file-based sources return empty.
 */
function extractFeatureData(
  model: IJupyterGISModel,
  layerId: string,
): Record<string, unknown>[] {
  const layer = model.getLayer(layerId);
  if (!layer || !layer.parameters?.source) {
    return [];
  }
  const source = model.getSource(layer.parameters.source);
  const data = (source as any)?.parameters?.data;
  if (data?.type === 'FeatureCollection' && Array.isArray(data.features)) {
    return data.features
      .map((f: any) => f.properties ?? {})
      .filter((p: any) => p !== null);
  }
  return [];
}

/**
 * Collect all plot specs from grammar layers across all model layers.
 */
function collectPlotSpecs(
  model: IJupyterGISModel,
  getData: (layerId: string) => Record<string, unknown>[],
): IPlotCard[] {
  const cards: IPlotCard[] = [];
  const layers = model.sharedModel.layers;
  if (!layers) {
    return cards;
  }

  for (const [layerId, layer] of Object.entries(layers)) {
    const state = (layer as any)?.parameters?.symbologyState;
    if (!state?.layers?.length) {
      continue;
    }

    const featureData =
      getData(layerId).length > 0
        ? getData(layerId)
        : extractFeatureData(model, layerId);

    for (const grammarLayer of state.layers) {
      const spec = grammarToPlotSpec({ layers: [grammarLayer] });
      if (!spec) {
        continue;
      }
      cards.push({
        layerId,
        layerName: (layer as any).name ?? layerId,
        grammarLayerId: grammarLayer.id,
        spec,
        data: featureData,
      });
    }
  }

  return cards;
}

/**
 * Renders a single Vega-Lite chart into a DOM container.
 */
const VegaLiteCard: React.FC<{ card: IPlotCard }> = ({ card }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const specWithData = { ...card.spec, data: { values: card.data } };
    vegaEmbed(container, specWithData, { actions: false }).catch(
      (err: Error) => {
        console.warn('Vega-Lite render failed:', err);
        if (container) {
          container.textContent = `Plot render error: ${err.message}`;
        }
      },
    );
  }, [card.spec, card.data]);

  return (
    <div
      className="jp-gis-plot-card"
      style={{
        border: '1px solid var(--jp-border-color2)',
        borderRadius: 4,
        padding: 8,
        margin: 4,
        background: 'var(--jp-layout-color1)',
      }}
    >
      <div
        className="jp-gis-plot-card-header"
        style={{
          fontSize: 'var(--jp-ui-font-size0)',
          color: 'var(--jp-ui-font-color2)',
          marginBottom: 4,
        }}
      >
        {card.layerName}
      </div>
      <div ref={containerRef} />
    </div>
  );
};

/**
 * Plot panel — renders a scrollable list of Vega-Lite chart cards.
 */
export const PlotPanel: React.FC<IPlotPanelProps> = ({ model, getData }) => {
  const [cards, setCards] = useState<IPlotCard[]>(() => []);

  const refresh = useCallback(() => {
    setCards(collectPlotSpecs(model, getData));
  }, [model, getData]);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    model.sharedModel.layersChanged?.connect(handler);
    return () => {
      model.sharedModel.layersChanged?.disconnect(handler);
    };
  }, [model, refresh]);

  if (cards.length === 0) {
    return (
      <div
        style={{
          padding: 16,
          color: 'var(--jp-ui-font-color2)',
          fontSize: 'var(--jp-ui-font-size1)',
        }}
      >
        No plot layers defined. Add plot-x, plot-y, or plot-color channels in
        the symbology dialog.
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        padding: 8,
        overflow: 'auto',
        height: '100%',
      }}
    >
      {cards.map(card => (
        <VegaLiteCard
          key={`${card.layerId}-${card.grammarLayerId}`}
          card={card}
        />
      ))}
    </div>
  );
};

export default PlotPanel;
