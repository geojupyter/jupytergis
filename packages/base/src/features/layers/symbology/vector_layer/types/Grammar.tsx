/**
 * Grammar symbology panel.
 *
 * Shows encoding rules grouped by layer. Each layer has optional render-side
 * transforms (KDE, cluster) followed by (field → scale → channels) mapping rows.
 * Multiple layers allow independent rendering pipelines on the same source.
 */

import {
  IEncodingRule,
  IGrammarLayer,
  IGrammarSymbologyState,
  IPredicate,
  ITransform,
  StyleChannel,
  RGBA,
} from '@jupytergis/schema';
import { Button } from '@jupyterlab/ui-components';
import { UUID } from '@lumino/coreutils';
import React, { useCallback, useEffect, useState } from 'react';

import MappingRow, {
  IGrammarRow,
  WhenAddForm,
  formatPredicate,
} from '@/src/features/layers/symbology/grammar/components/MappingRow';
import { NumericInput } from '@/src/features/layers/symbology/grammar/components/NumericInput';
import { useEffectiveSymbologyParams } from '@/src/features/layers/symbology/hooks/useEffectiveSymbologyParams';
import useGetBandInfo from '@/src/features/layers/symbology/hooks/useGetBandInfo';
import { useGetProperties } from '@/src/features/layers/symbology/hooks/useGetProperties';
import { useOkSignal } from '@/src/features/layers/symbology/hooks/useOkSignal';
import { ISymbologyDialogProps } from '@/src/features/layers/symbology/symbologyDialog';
import {
  saveSymbology,
  VectorSymbologyParams,
} from '@/src/features/layers/symbology/symbologyUtils';

const DEFAULT_CHANNELS: StyleChannel[] = ['fill-color', 'circle-fill-color'];
const DEFAULT_RGBA: RGBA = [128, 128, 128, 1];

// ---------------------------------------------------------------------------
// Layer UI state
// ---------------------------------------------------------------------------

interface ILayerUIState {
  id: string;
  transforms: ITransform[];
  rows: IGrammarRow[];
  when?: IPredicate[];
}

// ---------------------------------------------------------------------------
// Canonical → Grammar conversion
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Transform row
// ---------------------------------------------------------------------------

const TRANSFORM_TYPES: { value: ITransform['type']; label: string }[] = [
  { value: 'kde', label: 'KDE (heatmap)' },
  { value: 'cluster', label: 'cluster' },
];

function defaultTransform(type: ITransform['type']): ITransform {
  switch (type) {
    case 'kde':
      return { type: 'kde', radius: 10, blur: 15 };
    case 'cluster':
      return { type: 'cluster', radius: 40 };
  }
}

interface ITransformRowProps {
  transform: ITransform;
  availableFields: string[];
  onChange: (t: ITransform) => void;
  onDelete: () => void;
}

const TransformRow: React.FC<ITransformRowProps> = ({
  transform,
  availableFields,
  onChange,
  onDelete,
}) => {
  const handleTypeChange = (type: ITransform['type']) => {
    onChange(defaultTransform(type));
  };

  return (
    <div className="jp-gis-grammar-transform-row">
      {/* Type selector */}
      <div className="jp-select-wrapper" style={{ flex: '0 0 120px' }}>
        <select
          className="jp-mod-styled"
          value={transform.type}
          onChange={e => handleTypeChange(e.target.value as ITransform['type'])}
        >
          {TRANSFORM_TYPES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* KDE params */}
      {transform.type === 'kde' && (
        <>
          <label>radius</label>
          <NumericInput
            className="jp-mod-styled"
            style={{ width: 52 }}
            value={transform.radius}
            onChange={v => onChange({ ...transform, radius: v })}
          />
          <label>blur</label>
          <NumericInput
            className="jp-mod-styled"
            style={{ width: 52 }}
            value={transform.blur}
            onChange={v => onChange({ ...transform, blur: v })}
          />
          <label>weight</label>
          <div className="jp-select-wrapper" style={{ flex: '0 0 90px' }}>
            <select
              className="jp-mod-styled"
              value={transform.weightField ?? ''}
              onChange={e =>
                onChange({
                  ...transform,
                  weightField: e.target.value || undefined,
                })
              }
            >
              <option value="">(none)</option>
              {availableFields.map(f => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      {/* Cluster params */}
      {transform.type === 'cluster' && (
        <>
          <label>radius</label>
          <NumericInput
            className="jp-mod-styled"
            style={{ width: 52 }}
            value={transform.radius}
            onChange={v => onChange({ ...transform, radius: v })}
          />
        </>
      )}

      <button
        className="jp-gis-grammar-delete-btn"
        onClick={onDelete}
        title="Remove transform"
        style={{ marginLeft: 'auto' }}
      >
        ×
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Layer section
// ---------------------------------------------------------------------------

interface ILayerSectionProps {
  layer: ILayerUIState;
  layerIndex: number;
  totalLayers: number;
  availableFields: string[];
  featureValues: Record<string, Set<any>>;
  isRasterLayer?: boolean;
  onChange: (layer: ILayerUIState) => void;
  onDelete: () => void;
}

const LayerSection: React.FC<ILayerSectionProps> = ({
  layer,
  layerIndex,
  totalLayers,
  availableFields,
  featureValues,
  isRasterLayer = false,
  onChange,
  onDelete,
}) => {
  const [addingLayerWhen, setAddingLayerWhen] = useState(false);

  const addLayerPredicate = useCallback(
    (pred: IPredicate) => {
      onChange({ ...layer, when: [...(layer.when ?? []), pred] });
      setAddingLayerWhen(false);
    },
    [layer, onChange],
  );

  const removeLayerPredicate = useCallback(
    (index: number) => {
      const next = (layer.when ?? []).filter((_, i) => i !== index);
      onChange({ ...layer, when: next.length > 0 ? next : undefined });
    },
    [layer, onChange],
  );

  const updateTransform = useCallback(
    (index: number, t: ITransform) => {
      const next = [...layer.transforms];
      next[index] = t;
      onChange({ ...layer, transforms: next });
    },
    [layer, onChange],
  );

  const removeTransform = useCallback(
    (index: number) => {
      onChange({
        ...layer,
        transforms: layer.transforms.filter((_, i) => i !== index),
      });
    },
    [layer, onChange],
  );

  const addTransform = useCallback(() => {
    onChange({
      ...layer,
      transforms: [...layer.transforms, defaultTransform('kde')],
    });
  }, [layer, onChange]);

  const updateRow = useCallback(
    (index: number, row: IGrammarRow) => {
      const next = [...layer.rows];
      next[index] = row;
      onChange({ ...layer, rows: next });
    },
    [layer, onChange],
  );

  const removeRow = useCallback(
    (index: number) => {
      onChange({ ...layer, rows: layer.rows.filter((_, i) => i !== index) });
    },
    [layer, onChange],
  );

  const hasKDE = layer.transforms.some(t => t.type === 'kde');
  const isRaster = isRasterLayer || hasKDE;

  const addRow = useCallback(() => {
    const defaultChannels: StyleChannel[] = isRaster
      ? ['pixel-color']
      : DEFAULT_CHANNELS;
    onChange({
      ...layer,
      rows: [
        ...layer.rows,
        {
          id: UUID.uuid4(),
          scale: { scheme: 'constant_rgba', params: { value: DEFAULT_RGBA } },
          channels: [...defaultChannels],
        },
      ],
    });
  }, [layer, onChange, isRaster]);

  // KDE layers expose '$density'; raster layers expose $band-N fields.
  // Both cases suppress the raw feature attribute list.
  const encodingFields = hasKDE ? ['$density'] : availableFields;

  return (
    <div className="jp-gis-grammar-layer-section">
      {/* Layer header */}
      <div className="jp-gis-grammar-layer-header">
        <span className="jp-gis-grammar-layer-label">
          Layer {layerIndex + 1}
        </span>
        <button
          className="jp-gis-grammar-when-add-btn"
          onClick={addTransform}
          title="Add transform"
        >
          + transform
        </button>
        {totalLayers > 1 && (
          <button
            className="jp-gis-grammar-delete-btn"
            onClick={onDelete}
            title="Remove layer"
          >
            ×
          </button>
        )}
      </div>

      {/* Layer-level when clause */}
      <div className="jp-gis-grammar-when-row">
        <span className="jp-gis-grammar-when-label">when</span>
        {layer.when?.map((pred, i) => (
          <span key={i} className="jp-gis-grammar-when-chip">
            {formatPredicate(pred)}
            <button
              onClick={() => removeLayerPredicate(i)}
              title="Remove condition"
            >
              ×
            </button>
          </span>
        ))}
        {addingLayerWhen ? (
          <WhenAddForm
            availableFields={availableFields}
            onAdd={addLayerPredicate}
            onCancel={() => setAddingLayerWhen(false)}
          />
        ) : (
          <button
            className="jp-gis-grammar-when-add-btn"
            onClick={() => setAddingLayerWhen(true)}
          >
            + add
          </button>
        )}
      </div>

      {/* Transforms */}
      {layer.transforms.map((t, i) => (
        <TransformRow
          key={i}
          transform={t}
          availableFields={availableFields}
          onChange={updated => updateTransform(i, updated)}
          onDelete={() => removeTransform(i)}
        />
      ))}

      {/* Mapping rows */}
      {layer.rows.map((row, i) => (
        <MappingRow
          key={row.id}
          row={row}
          availableFields={encodingFields}
          featureValues={featureValues}
          isRaster={isRaster}
          onChange={updated => updateRow(i, updated)}
          onDelete={() => removeRow(i)}
        />
      ))}

      <div className="jp-gis-symbology-button-container">
        <Button
          className="jp-Dialog-button jp-mod-accept jp-mod-styled"
          onClick={addRow}
        >
          Add Mapping
        </Button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Grammar panel
// ---------------------------------------------------------------------------

const Grammar: React.FC<ISymbologyDialogProps> = ({
  model,
  okSignalPromise,
  layerId,
  isStorySegmentOverride,
  segmentId,
}) => {
  const layer = layerId !== undefined ? model.getLayer(layerId) : null;
  const isRasterLayer = layer?.type === 'GeoTiffLayer';

  const { featureProperties: selectableAttributesAndValues } = useGetProperties(
    { layerId, model },
  );

  // For raster layers, expose $band-N pseudo-fields derived from band metadata.
  const { bandRows } = useGetBandInfo(model, layer);

  const params = useEffectiveSymbologyParams<VectorSymbologyParams>({
    model,
    layerId,
    layer,
    isStorySegmentOverride,
    segmentId,
  });

  const [layers, setLayers] = useState<ILayerUIState[]>([
    { id: UUID.uuid4(), transforms: [], rows: [] },
  ]);

  useEffect(() => {
    if (!params?.symbologyState) {
      return;
    }
    const rawState = params.symbologyState;
    if (
      !Array.isArray((rawState as any).layers) ||
      !(rawState as any).layers.length
    ) {
      setLayers([{ id: UUID.uuid4(), transforms: [], rows: [] }]);
      return;
    }
    const state = rawState as IGrammarSymbologyState;
    setLayers(
      state.layers.map(grammarLayer => ({
        id: grammarLayer.id,
        transforms: grammarLayer.preprocess ?? [],
        ...(grammarLayer.when?.length ? { when: grammarLayer.when } : {}),
        rows: grammarLayer.rules.flatMap(rule =>
          rule.mappings.map((mapping, mi) => ({
            // Preserve the rule's stable id so React keys and story-segment
            // override merging stay consistent across dialog opens.
            // When a rule has multiple mappings, suffix with the mapping index.
            id: rule.mappings.length === 1 ? rule.id : `${rule.id}-${mi}`,
            fields: rule.fields?.length ? rule.fields : undefined,
            scale: mapping.scale,
            channels: [...(mapping.channels as StyleChannel[])],
            ...(rule.when ? { when: rule.when } : {}),
          })),
        ),
      })),
    );
  }, [params]);

  const handleOk = () => {
    if (!layerId || !layer?.parameters) {
      return;
    }

    const grammarLayers: IGrammarLayer[] = layers.map(uiLayer => {
      const rules: IEncodingRule[] = uiLayer.rows
        .filter(row => row.channels.length > 0)
        .map(row => ({
          id: row.id,
          ...(row.fields?.length ? { fields: row.fields } : {}),
          ...(row.when?.length ? { when: row.when } : {}),
          mappings: [
            {
              scale: row.scale,
              channels: row.channels as [StyleChannel, ...StyleChannel[]],
            },
          ],
        }));

      return {
        id: uiLayer.id,
        ...(uiLayer.transforms.length
          ? { preprocess: uiLayer.transforms }
          : {}),
        ...(uiLayer.when?.length ? { when: uiLayer.when } : {}),
        rules,
      };
    });

    const symbologyState: IGrammarSymbologyState = {
      layers: grammarLayers,
    };

    saveSymbology({
      model,
      layerId,
      isStorySegmentOverride,
      segmentId,
      payload: { symbologyState },
      mutateLayerBeforeSave: targetLayer => {
        if (targetLayer.parameters?.color !== undefined) {
          delete targetLayer.parameters.color;
        }
      },
    });
  };

  useOkSignal(okSignalPromise, handleOk);

  const addLayer = () => {
    setLayers(prev => [
      ...prev,
      { id: UUID.uuid4(), transforms: [], rows: [] },
    ]);
  };

  const availableFields = isRasterLayer
    ? bandRows.map(b => `$band-${b.band}`)
    : Object.keys(selectableAttributesAndValues);

  return (
    <div className="jp-gis-layer-symbology-container">
      {layers.map((uiLayer, i) => (
        <LayerSection
          key={uiLayer.id}
          layer={uiLayer}
          layerIndex={i}
          totalLayers={layers.length}
          availableFields={availableFields}
          featureValues={selectableAttributesAndValues}
          isRasterLayer={isRasterLayer}
          onChange={updated =>
            setLayers(prev => prev.map((l, j) => (j === i ? updated : l)))
          }
          onDelete={() => setLayers(prev => prev.filter((_, j) => j !== i))}
        />
      ))}
      <div className="jp-gis-symbology-button-container">
        <Button
          className="jp-Dialog-button jp-mod-accept jp-mod-styled"
          onClick={addLayer}
        >
          Add Layer
        </Button>
      </div>
    </div>
  );
};

export default Grammar;
