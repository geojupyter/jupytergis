/**
 * Grammar symbology panel.
 *
 * Shows the raw encoding rules as a list of (field → scale → channels) rows.
 * Each row is one IMapping; fan-out channels are shown as removable chips.
 * Switching to another render type uses the existing adapter in those panels.
 */

import {
  IEncodingRule,
  IGrammarLayer,
  IGrammarSymbologyState,
  OLStyleChannel,
  RGBA,
} from '@jupytergis/schema';
import { Button } from '@jupyterlab/ui-components';
import { UUID } from '@lumino/coreutils';
import React, { useEffect, useState } from 'react';

import MappingRow, {
  IGrammarRow,
} from '@/src/features/layers/symbology/grammar/components/MappingRow';
import { useEffectiveSymbologyParams } from '@/src/features/layers/symbology/hooks/useEffectiveSymbologyParams';
import { useOkSignal } from '@/src/features/layers/symbology/hooks/useOkSignal';
import { ISymbologyDialogWithAttributesProps } from '@/src/features/layers/symbology/symbologyDialog';
import {
  saveSymbology,
  VectorSymbologyParams,
} from '@/src/features/layers/symbology/symbologyUtils';

const DEFAULT_CHANNELS: OLStyleChannel[] = ['fill-color', 'circle-fill-color'];
const DEFAULT_RGBA: RGBA = [128, 128, 128, 1];

/** Convert a Canonical symbologyState to Grammar rows (best-effort). */
function canonicalToGrammarRows(state: any): IGrammarRow[] {
  const rows: IGrammarRow[] = [];
  if (state.strokeFollowsFill !== false) {
    // identity scale covers fill + stroke
    rows.push({
      id: UUID.uuid4(),
      fields: state.value ? [state.value] : undefined,
      scale: { scheme: 'identity' },
      channels: [
        'fill-color',
        'circle-fill-color',
        'stroke-color',
        'circle-stroke-color',
      ] as OLStyleChannel[],
    });
  } else {
    rows.push({
      id: UUID.uuid4(),
      fields: state.value ? [state.value] : undefined,
      scale: { scheme: 'identity' },
      channels: ['fill-color', 'circle-fill-color'] as OLStyleChannel[],
    });
    rows.push({
      id: UUID.uuid4(),
      scale: {
        scheme: 'constant_rgba',
        params: { value: state.strokeColor ?? DEFAULT_RGBA },
      },
      channels: ['stroke-color', 'circle-stroke-color'] as OLStyleChannel[],
    });
  }
  rows.push({
    id: UUID.uuid4(),
    scale: {
      scheme: 'constant_num',
      params: { value: state.strokeWidth ?? 1 },
    },
    channels: ['stroke-width', 'circle-stroke-width'] as OLStyleChannel[],
  });
  return rows;
}

const Grammar: React.FC<ISymbologyDialogWithAttributesProps> = ({
  model,
  okSignalPromise,
  layerId,
  selectableAttributesAndValues,
  isStorySegmentOverride,
  segmentId,
}) => {
  const layer = layerId !== undefined ? model.getLayer(layerId) : null;
  const params = useEffectiveSymbologyParams<VectorSymbologyParams>({
    model,
    layerId,
    layer,
    isStorySegmentOverride,
    segmentId,
  });

  const [rows, setRows] = useState<IGrammarRow[]>([]);

  useEffect(() => {
    if (!params?.symbologyState) {
      return;
    }
    const rawState = params.symbologyState;
    if (
      rawState?.renderType !== 'Grammar' ||
      !(rawState as any).layers?.length
    ) {
      if (rawState?.renderType === 'Canonical') {
        setRows(canonicalToGrammarRows(rawState));
      } else {
        setRows([]);
      }
      return;
    }
    const state = rawState as IGrammarSymbologyState;
    // Flatten all layers/rules into the flat row model used by the UI.
    // Layer and transform structure is preserved on save via layersRef.
    setRows(
      state.layers.flatMap(layer =>
        layer.rules.flatMap(rule =>
          rule.mappings.map(mapping => ({
            id: UUID.uuid4(),
            fields: rule.fields?.length ? rule.fields : undefined,
            scale: mapping.scale,
            channels: [...(mapping.channels as OLStyleChannel[])],
            ...(rule.when ? { when: rule.when } : {}),
          })),
        ),
      ),
    );
  }, [params]);

  const handleOk = () => {
    if (!layerId || !layer?.parameters) {
      return;
    }
    const rules: IEncodingRule[] = rows
      .filter(row => row.channels.length > 0)
      .map(row => ({
        id: row.id,
        ...(row.fields?.length ? { fields: row.fields } : {}),
        ...(row.when?.length ? { when: row.when } : {}),
        mappings: [
          {
            scale: row.scale,
            channels: row.channels as [OLStyleChannel, ...OLStyleChannel[]],
          },
        ],
      }));

    const grammarLayer: IGrammarLayer = { id: UUID.uuid4(), rules };
    const symbologyState: IGrammarSymbologyState = {
      renderType: 'Grammar',
      layers: [grammarLayer],
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

  const addRow = () => {
    setRows(prev => [
      ...prev,
      {
        id: UUID.uuid4(),
        scale: { scheme: 'constant_rgba', params: { value: DEFAULT_RGBA } },
        channels: [...DEFAULT_CHANNELS],
      },
    ]);
  };

  const availableFields = Object.keys(selectableAttributesAndValues);

  return (
    <div className="jp-gis-layer-symbology-container">
      {rows.map((row, i) => (
        <MappingRow
          key={row.id}
          row={row}
          availableFields={availableFields}
          featureValues={selectableAttributesAndValues}
          onChange={updated =>
            setRows(prev => prev.map((r, j) => (j === i ? updated : r)))
          }
          onDelete={() => setRows(prev => prev.filter((_, j) => j !== i))}
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

export default Grammar;
