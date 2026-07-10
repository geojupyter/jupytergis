/**
 * Grammar symbology panel.
 *
 * Shows encoding rules grouped by layer. Each layer has optional render-side
 * transforms (KDE, cluster) followed by (field → scale → channels) mapping rows.
 * Multiple layers allow independent rendering pipelines on the same source.
 */

import {
  faArrowDown,
  faArrowUp,
  faGripVertical,
  faPlus,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  IEncodingRule,
  IGrammarLayer,
  IGrammarSymbologyState,
  IPredicate,
  IScale,
  ITransform,
  Encoding,
  RGBA,
} from '@jupytergis/schema';
import { UUID } from '@lumino/coreutils';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import MappingRow, {
  IGrammarRow,
  WhenRow,
  defaultPredicate,
} from '@/src/features/layers/symbology/components/MappingRow';
import { NumericInput } from '@/src/features/layers/symbology/components/NumericInput';
import { useEffectiveSymbologyParams } from '@/src/features/layers/symbology/hooks/useEffectiveSymbologyParams';
import useGetBandInfo from '@/src/features/layers/symbology/hooks/useGetBandInfo';
import { useGetProperties } from '@/src/features/layers/symbology/hooks/useGetProperties';
import { useOkSignal } from '@/src/features/layers/symbology/hooks/useOkSignal';
import { ISymbologyDialogProps } from '@/src/features/layers/symbology/symbologyDialog';
import {
  saveSymbology,
  VectorSymbologyParams,
} from '@/src/features/layers/symbology/symbologyUtils';
import { Button } from '@/src/shared/components/Button';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/src/shared/components/NativeSelect';

const DEFAULT_CHANNELS: Encoding[] = ['fill-color', 'circle-fill-color'];
const DEFAULT_RGBA: RGBA = [128, 128, 128, 1];

// Scale schemes that cannot be round-tripped through the QGIS format, and are
// therefore hidden from the picker while a QGIS document is open.
const QGIS_UNSUPPORTED_SCHEMES: IScale['scheme'][] = ['expression'];

// ---------------------------------------------------------------------------
// Layer UI state
// ---------------------------------------------------------------------------

interface ILayerUIState {
  id: string;
  transforms: ITransform[];
  rows: IGrammarRow[];
  when?: IPredicate[];
  whenOp?: 'all' | 'any';
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
    default:
      throw new Error(`Invalid transform type ${type}`);
  }
}

interface ITransformRowProps {
  transform: ITransform;
  availableFields: IFieldOption[];
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
      <NativeSelect
        value={transform.type}
        onChange={e => handleTypeChange(e.target.value as ITransform['type'])}
      >
        {TRANSFORM_TYPES.map(({ value, label }) => (
          <NativeSelectOption key={value} value={value}>
            {label}
          </NativeSelectOption>
        ))}
      </NativeSelect>

      {/* KDE params */}
      {transform.type === 'kde' && (
        <>
          <label>radius</label>
          <NumericInput
            style={{ width: 52 }}
            value={transform.radius}
            onChange={v => onChange({ ...transform, radius: v })}
          />
          <label>blur</label>
          <NumericInput
            style={{ width: 52 }}
            value={transform.blur}
            onChange={v => onChange({ ...transform, blur: v })}
          />
          <label>weight</label>
          <NativeSelect
            value={transform.weightField ?? ''}
            onChange={e =>
              onChange({
                ...transform,
                weightField: e.target.value || undefined,
              })
            }
          >
            <NativeSelectOption value="">(none)</NativeSelectOption>
            {availableFields.map(field => (
              <NativeSelectOption key={field.value} value={field.value}>
                {field.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </>
      )}

      {/* Cluster params */}
      {transform.type === 'cluster' && (
        <>
          <label>radius</label>
          <NumericInput
            style={{ width: 52 }}
            value={transform.radius}
            onChange={v => onChange({ ...transform, radius: v })}
          />
        </>
      )}

      <Button
        type="button"
        variant="ghost"
        onClick={onDelete}
        title="Remove transform"
        style={{ marginLeft: 'auto' }}
      >
        <FontAwesomeIcon icon={faTrash} />
      </Button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Layer section
// ---------------------------------------------------------------------------

interface IFieldOption {
  value: string;
  label: string;
}
interface ILayerSectionProps {
  layer: ILayerUIState;
  layerIndex: number;
  totalLayers: number;
  availableFields: IFieldOption[];
  featureValues: Record<string, Set<any>>;
  isRasterLayer?: boolean;
  disabledSchemes?: IScale['scheme'][];
  onChange: (layer: ILayerUIState) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

const LayerSection: React.FC<ILayerSectionProps> = ({
  layer,
  layerIndex,
  totalLayers,
  availableFields,
  featureValues,
  isRasterLayer = false,
  disabledSchemes = [],
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}) => {
  const dragIndexRef = useRef<number | null>(null);
  const dragOverRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const moveRow = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) {
        return;
      }
      const next = [...layer.rows];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      onChange({ ...layer, rows: next });
    },
    [layer, onChange],
  );

  const addLayerPredicate = useCallback(() => {
    onChange({ ...layer, when: [...(layer.when ?? []), defaultPredicate()] });
  }, [layer, onChange]);

  const updateLayerPredicate = useCallback(
    (index: number, pred: IPredicate) => {
      const next = [...(layer.when ?? [])];
      next[index] = pred;
      onChange({ ...layer, when: next });
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

  const addTransform = useCallback(() => {
    if (layer.transforms.length > 0) {
      return;
    }
    onChange({
      ...layer,
      transforms: [defaultTransform('kde')],
    });
  }, [layer, onChange]);

  const updateTransform = useCallback(
    (t: ITransform) => {
      onChange({ ...layer, transforms: [t] });
    },
    [layer, onChange],
  );

  const removeTransform = useCallback(() => {
    onChange({ ...layer, transforms: [] });
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
    const defaultChannels: Encoding[] = isRaster
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
  const encodingFields: IFieldOption[] = hasKDE
    ? [{ value: '$density', label: '$density' }]
    : availableFields;

  return (
    <div className="jp-gis-grammar-layer-section">
      {/* Layer header */}
      <div className="jp-gis-grammar-layer-header">
        <span className="jp-gis-grammar-layer-label">
          Layer {layerIndex + 1}
        </span>
        {layer.transforms.length === 0 && (
          <Button
            type="button"
            variant="ghost"
            onClick={addTransform}
            title="Add transform"
          >
            <FontAwesomeIcon data-icon="inline-start" icon={faPlus} />
            Transform
          </Button>
        )}

        {totalLayers > 1 && onMoveUp && (
          <Button
            type="button"
            variant="ghost"
            style={{ height: 32, width: 32 }}
            onClick={onMoveUp}
            title="Move layer up"
          >
            <FontAwesomeIcon icon={faArrowUp} />
          </Button>
        )}
        {totalLayers > 1 && onMoveDown && (
          <Button
            type="button"
            variant="ghost"
            style={{ height: 32, width: 32 }}
            onClick={onMoveDown}
            title="Move layer down"
          >
            <FontAwesomeIcon icon={faArrowDown} />
          </Button>
        )}
        {totalLayers > 1 && (
          <Button
            type="button"
            variant="ghost"
            style={{ height: 32, width: 32 }}
            onClick={onDelete}
            title="Remove layer"
          >
            <FontAwesomeIcon icon={faTrash} />
          </Button>
        )}
      </div>

      {/* Layer-level when clause */}
      <div className="jp-gis-grammar-when-row">
        <span className="jp-gis-grammar-when-label">when</span>
        {(layer.when?.length ?? 0) > 1 && (
          <Button
            type="button"
            className="jp-gis-grammar-when-op"
            onClick={() =>
              onChange({
                ...layer,
                whenOp: (layer.whenOp ?? 'all') === 'all' ? 'any' : 'all',
              })
            }
          >
            {layer.whenOp ?? 'all'}
          </Button>
        )}
        {layer.when?.map((pred, i) => (
          <WhenRow
            key={i}
            predicate={pred}
            availableFields={availableFields}
            onChange={updated => updateLayerPredicate(i, updated)}
            onDelete={() => removeLayerPredicate(i)}
          />
        ))}
        <Button
          type="button"
          className="jp-gis-grammar-when-add-btn"
          onClick={addLayerPredicate}
          title="Add condition"
        >
          <FontAwesomeIcon icon={faPlus} />
        </Button>
      </div>

      {/* Transform params (single transform per layer) */}
      {layer.transforms[0] && (
        <TransformRow
          transform={layer.transforms[0]}
          availableFields={availableFields}
          onChange={updateTransform}
          onDelete={removeTransform}
        />
      )}

      {/* Mapping rows — reorder bar (drag + arrows) above each rule */}
      {/* Container handles drag events so drops work even at top/bottom edges */}
      <div
        className="jp-gis-grammar-rules-container"
        onDragOver={e => {
          e.preventDefault();
          // Find which wrapper the cursor is closest to
          const wrappers = Array.from(
            e.currentTarget.querySelectorAll(
              ':scope > .jp-gis-grammar-drag-wrapper',
            ),
          );
          let idx = layer.rows.length;
          for (let j = 0; j < wrappers.length; j++) {
            const rect = wrappers[j].getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            if (e.clientY < midY) {
              idx = j;
              break;
            }
          }
          dragOverRef.current = idx;
          setDragOverIndex(idx);
        }}
        onDrop={() => {
          const over = dragOverRef.current;
          if (dragIndexRef.current !== null && over !== null) {
            const to = over > dragIndexRef.current ? over - 1 : over;
            moveRow(dragIndexRef.current, to);
          }
          dragIndexRef.current = null;
          dragOverRef.current = null;
          setDragOverIndex(null);
        }}
        onDragEnd={() => {
          dragIndexRef.current = null;
          dragOverRef.current = null;
          setDragOverIndex(null);
        }}
      >
        {layer.rows.map((row, i) => (
          <div
            key={row.id}
            className="jp-gis-grammar-drag-wrapper"
            style={{
              borderTop:
                dragOverIndex === i && dragIndexRef.current !== i
                  ? '2px solid var(--jp-brand-color1)'
                  : '2px solid transparent',
              borderBottom:
                dragOverIndex === layer.rows.length &&
                i === layer.rows.length - 1 &&
                dragIndexRef.current !== i
                  ? '2px solid var(--jp-brand-color1)'
                  : '2px solid transparent',
            }}
          >
            {layer.rows.length > 1 && (
              <div className="jp-gis-grammar-reorder-bar">
                <Button
                  type="button"
                  disabled={i === 0}
                  onClick={() => moveRow(i, i - 1)}
                  title="Move up"
                >
                  <FontAwesomeIcon icon={faArrowUp} />
                </Button>
                <div
                  className="jp-gis-grammar-drag-handle"
                  draggable
                  onDragStart={e => {
                    dragIndexRef.current = i;
                    const wrapper = e.currentTarget.closest(
                      '.jp-gis-grammar-drag-wrapper',
                    );
                    if (wrapper) {
                      e.dataTransfer.setDragImage(wrapper, 0, 0);
                    }
                  }}
                  title="Drag to reorder"
                >
                  <FontAwesomeIcon icon={faGripVertical} />
                </div>
                <Button
                  type="button"
                  disabled={i === layer.rows.length - 1}
                  onClick={() => moveRow(i, i + 1)}
                  title="Move down"
                >
                  <FontAwesomeIcon icon={faArrowDown} />
                </Button>
              </div>
            )}
            <MappingRow
              row={row}
              availableFields={encodingFields}
              featureValues={featureValues}
              isRaster={isRaster}
              disabledSchemes={disabledSchemes}
              onChange={updated => updateRow(i, updated)}
              onDelete={() => removeRow(i)}
            />
          </div>
        ))}
      </div>

      <div className="jp-gis-symbology-button-container">
        <Button
          variant="ghost"
          style={{ margin: '0 0 0.5rem 1rem' }}
          onClick={addRow}
        >
          <FontAwesomeIcon icon={faPlus} />
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
  const isRasterLayer =
    layer?.type === 'GeoTiffLayer' || layer?.type === 'GeoZarrLayer';

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
        ...(grammarLayer.whenOp ? { whenOp: grammarLayer.whenOp } : {}),
        rows: grammarLayer.rules.flatMap(rule =>
          rule.mappings.map((mapping, mi) => ({
            // Preserve the rule's stable id so React keys and story-segment
            // override merging stay consistent across dialog opens.
            // When a rule has multiple mappings, suffix with the mapping index.
            id: rule.mappings.length === 1 ? rule.id : `${rule.id}-${mi}`,
            fields: rule.fields?.length ? rule.fields : undefined,
            scale: mapping.scale,
            channels: [...(mapping.channels as Encoding[])],
            ...(rule.when ? { when: rule.when } : {}),
            ...(rule.whenOp ? { whenOp: rule.whenOp } : {}),
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
          ...(row.whenOp ? { whenOp: row.whenOp } : {}),
          mappings: [
            {
              scale: row.scale,
              channels: row.channels as [Encoding, ...Encoding[]],
            },
          ],
        }));

      return {
        id: uiLayer.id,
        ...(uiLayer.transforms.length
          ? { preprocess: uiLayer.transforms }
          : {}),
        ...(uiLayer.when?.length ? { when: uiLayer.when } : {}),
        ...(uiLayer.whenOp ? { whenOp: uiLayer.whenOp } : {}),
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

  const moveLayer = useCallback(
    (from: number, to: number) => {
      if (from === to) {
        return;
      }
      setLayers(prev => {
        const next = [...prev];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return next;
      });
    },
    [setLayers],
  );

  const availableFields = isRasterLayer
    ? bandRows.map(b => ({
        value: `$band-${b.band}`,
        label: `$band-${b.band}  ${b.name}${
          b.colorInterpretation ? ` (${b.colorInterpretation})` : ''
        }`,
      }))
    : Object.keys(selectableAttributesAndValues).map(f => ({
        value: f,
        label: f,
      }));

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
          disabledSchemes={model.isQgisDocument ? QGIS_UNSUPPORTED_SCHEMES : []}
          onChange={updated =>
            setLayers(prev => prev.map((l, j) => (j === i ? updated : l)))
          }
          onDelete={() => setLayers(prev => prev.filter((_, j) => j !== i))}
          onMoveUp={i > 0 ? () => moveLayer(i, i - 1) : undefined}
          onMoveDown={
            i < layers.length - 1 ? () => moveLayer(i, i + 1) : undefined
          }
        />
      ))}
      <div className="jp-gis-symbology-button-container">
        <Button className="jp-gis-grammar-action-btn" onClick={addLayer}>
          Add Layer
        </Button>
      </div>
    </div>
  );
};

export default Grammar;
