/**
 * Inline scale editor for one IMapping.
 * Renders a different UI for each scale scheme.
 */

import {
  ClassificationMode,
  ICategoricalScale,
  IColorRampScale,
  IConstantNumScale,
  IConstantRGBAScale,
  IScale,
  IScalarScale,
  OLStyleChannel,
  RGBA,
} from '@jupytergis/schema';
import { UUID } from '@lumino/coreutils';
import React, { useCallback, useState } from 'react';

import { ColorRampName } from '@/src/features/layers/symbology/colorRampUtils';
import ColorRampSelector from '@/src/features/layers/symbology/components/color_ramp/ColorRampSelector';
import RgbaColorPicker, {
  RgbaColor,
} from '@/src/features/layers/symbology/components/color_ramp/RgbaColorPicker';
import StopContainer from '@/src/features/layers/symbology/components/color_stops/StopContainer';
import {
  computeCategorizedColorStops,
  computeGraduatedColorStops,
  IComputedStop,
} from '@/src/features/layers/symbology/styleBuilder';
import { IStopRow } from '@/src/features/layers/symbology/symbologyDialog';

const POSFLOAT_CHANNELS = new Set<OLStyleChannel>([
  'stroke-width',
  'circle-stroke-width',
  'circle-radius',
]);

function stopsToRows(
  stops: Array<{ stop: number | string; color: RGBA }>,
): IStopRow[] {
  return stops.map(s => ({
    id: UUID.uuid4(),
    stop: s.stop,
    output: s.color as RgbaColor,
  }));
}

function rowsToColorStops(
  rows: IStopRow[],
): Array<{ stop: number | string; color: RGBA }> {
  return rows
    .filter(r => r.output !== undefined)
    .map(r => ({ stop: r.stop, color: r.output as RGBA }));
}

const MODE_OPTIONS: ClassificationMode[] = [
  'equal interval',
  'quantile',
  'jenks',
  'pretty',
  'logarithmic',
];

// ---------------------------------------------------------------------------
// Constant editor
// ---------------------------------------------------------------------------

interface IConstantEditorProps {
  scale: IConstantRGBAScale | IConstantNumScale;
  channels: OLStyleChannel[];
  onChange: (scale: IScale) => void;
}

export const ConstantEditor: React.FC<IConstantEditorProps> = ({
  scale,
  onChange,
}) => {
  if (scale.scheme === 'constant_num') {
    return (
      <div className="jp-gis-symbology-row">
        <label>Value</label>
        <input
          className="jp-mod-styled"
          type="number"
          min={0}
          step={0.1}
          value={scale.params.value}
          onChange={e =>
            onChange({
              scheme: 'constant_num',
              params: { value: Number(e.target.value) },
            })
          }
        />
      </div>
    );
  }

  return (
    <div className="jp-gis-symbology-row">
      <label>Color</label>
      <RgbaColorPicker
        color={scale.params.value as RgbaColor}
        onChange={color =>
          onChange({ scheme: 'constant_rgba', params: { value: color } })
        }
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// ColorRamp editor
// ---------------------------------------------------------------------------

interface IColorRampEditorProps {
  scale: IColorRampScale;
  field: string | undefined;
  featureValues: Record<string, Set<any>>;
  onChange: (scale: IScale) => void;
}

export const ColorRampEditor: React.FC<IColorRampEditorProps> = ({
  scale,
  field,
  featureValues,
  onChange,
}) => {
  const { params } = scale;
  const [stopRows, setStopRows] = useState<IStopRow[]>(
    params.colorStops ? stopsToRows(params.colorStops) : [],
  );

  const update = useCallback(
    (patch: Partial<IColorRampScale['params']>) =>
      onChange({ scheme: 'colorRamp', params: { ...params, ...patch } }),
    [params, onChange],
  );

  const classify = () => {
    if (!field) {
      return;
    }
    const values = Array.from(featureValues[field] ?? []).filter(
      (v): v is number => Number.isFinite(v),
    );
    const computed: IComputedStop[] = computeGraduatedColorStops(
      {
        renderType: 'Graduated',
        nClasses: params.nShades,
        mode: params.mode as any,
        colorRamp: params.name,
        reverseRamp: params.reverse,
        vmin: params.domain?.[0],
        vmax: params.domain?.[1],
      } as any,
      values,
    );
    const rows = computed.map(s => ({
      id: UUID.uuid4(),
      stop: s.value as number,
      output: s.color as RgbaColor,
    }));
    setStopRows(rows);
    update({
      colorStops: computed.map(s => ({
        stop: s.value as number,
        color: s.color as RGBA,
      })),
    });
  };

  const handleStopRowsChange = (rows: IStopRow[]) => {
    setStopRows(rows);
    update({
      colorStops: rowsToColorStops(rows) as Array<{
        stop: number;
        color: RGBA;
      }>,
    });
  };

  return (
    <div className="jp-gis-color-ramp-container">
      <div className="jp-gis-symbology-row">
        <label>Ramp</label>
        <ColorRampSelector
          selectedRamp={params.name as ColorRampName}
          setSelected={name => update({ name })}
          reverse={params.reverse}
          setReverse={v =>
            update({ reverse: typeof v === 'function' ? v(params.reverse) : v })
          }
        />
      </div>
      <div className="jp-gis-symbology-row">
        <label>Mode</label>
        <div className="jp-select-wrapper">
          <select
            className="jp-mod-styled"
            value={params.mode}
            onChange={e =>
              update({ mode: e.target.value as ClassificationMode })
            }
          >
            {MODE_OPTIONS.map(m => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="jp-gis-symbology-row">
        <label>Classes</label>
        <input
          className="jp-mod-styled"
          type="number"
          min={2}
          max={256}
          value={params.nShades}
          onChange={e => update({ nShades: Number(e.target.value) })}
        />
      </div>
      <div className="jp-gis-symbology-row">
        <label>Domain</label>
        <div style={{ display: 'flex', gap: 4, flex: '1 0 50%' }}>
          <input
            className="jp-mod-styled"
            type="number"
            placeholder="min"
            value={params.domain?.[0] ?? ''}
            onChange={e => {
              const v = Number(e.target.value);
              update({ domain: [v, params.domain?.[1] ?? v] });
            }}
          />
          <input
            className="jp-mod-styled"
            type="number"
            placeholder="max"
            value={params.domain?.[1] ?? ''}
            onChange={e => {
              const v = Number(e.target.value);
              update({ domain: [params.domain?.[0] ?? v, v] });
            }}
          />
        </div>
      </div>
      <button
        className="jp-Dialog-button jp-mod-accept jp-mod-styled"
        disabled={!field}
        onClick={classify}
      >
        Classify
      </button>
      {stopRows.length > 0 && (
        <StopContainer
          selectedMethod="color"
          stopRows={stopRows}
          setStopRows={handleStopRowsChange}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Categorical editor
// ---------------------------------------------------------------------------

interface ICategoricalEditorProps {
  scale: ICategoricalScale;
  field: string | undefined;
  featureValues: Record<string, Set<any>>;
  onChange: (scale: IScale) => void;
}

export const CategoricalEditor: React.FC<ICategoricalEditorProps> = ({
  scale,
  field,
  featureValues,
  onChange,
}) => {
  const { params } = scale;

  const initialRows: IStopRow[] = params.colorStops
    ? stopsToRows(params.colorStops)
    : [];
  const [stopRows, setStopRows] = useState<IStopRow[]>(initialRows);

  const update = useCallback(
    (patch: Partial<ICategoricalScale['params']>) =>
      onChange({ scheme: 'categorical', params: { ...params, ...patch } }),
    [params, onChange],
  );

  const classify = () => {
    if (!field) {
      return;
    }
    const values = Array.from(featureValues[field] ?? []);
    const computed: IComputedStop[] = computeCategorizedColorStops(
      {
        renderType: 'Categorized',
        colorRamp: params.colorRamp,
        reverseRamp: params.reverse ?? false,
      } as any,
      values,
    );
    const rows = computed.map(s => ({
      id: UUID.uuid4(),
      stop: s.value as string | number,
      output: s.color as RgbaColor,
    }));
    setStopRows(rows);
    update({
      colorStops: computed.map(s => ({
        stop: s.value as string | number,
        color: s.color as RGBA,
      })),
    });
  };

  const handleStopRowsChange = (rows: IStopRow[]) => {
    setStopRows(rows);
    update({ colorStops: rowsToColorStops(rows) });
  };

  return (
    <div className="jp-gis-color-ramp-container">
      <div className="jp-gis-symbology-row">
        <label>Ramp</label>
        <ColorRampSelector
          selectedRamp={params.colorRamp as ColorRampName}
          setSelected={colorRamp => update({ colorRamp })}
          reverse={params.reverse ?? false}
          setReverse={v =>
            update({
              reverse: typeof v === 'function' ? v(params.reverse ?? false) : v,
            })
          }
        />
      </div>
      <button
        className="jp-Dialog-button jp-mod-accept jp-mod-styled"
        disabled={!field}
        onClick={classify}
      >
        Classify
      </button>
      {stopRows.length > 0 && (
        <StopContainer
          selectedMethod="color"
          stopRows={stopRows}
          setStopRows={handleStopRowsChange}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Scalar editor
// ---------------------------------------------------------------------------

interface IScalarEditorProps {
  scale: IScalarScale;
  field: string | undefined;
  featureValues: Record<string, Set<any>>;
  onChange: (scale: IScale) => void;
}

export const ScalarEditor: React.FC<IScalarEditorProps> = ({
  scale,
  field,
  featureValues,
  onChange,
}) => {
  const { params } = scale;

  const update = useCallback(
    (patch: Partial<IScalarScale['params']>) =>
      onChange({ scheme: 'scalar', params: { ...params, ...patch } }),
    [params, onChange],
  );

  const [stopRows, setStopRows] = useState<IStopRow[]>(
    params.scalarStops
      ? params.scalarStops.map(s => ({
          id: UUID.uuid4(),
          stop: s.stop,
          output: s.output,
        }))
      : [],
  );

  const classify = () => {
    const inMin = params.domain[0];
    const inMax = params.domain[1];
    const outMin = params.range[0];
    const outMax = params.range[1];
    const rows: IStopRow[] = [
      { id: UUID.uuid4(), stop: inMin, output: outMin },
      { id: UUID.uuid4(), stop: inMax, output: outMax },
    ];
    setStopRows(rows);
    update({
      scalarStops: [
        { stop: inMin, output: outMin },
        { stop: inMax, output: outMax },
      ],
    });
  };

  const handleStopRowsChange = (rows: IStopRow[]) => {
    setStopRows(rows);
    update({
      scalarStops: rows.map(r => ({
        stop: r.stop as number,
        output: r.output as number,
      })),
    });
  };

  return (
    <div className="jp-gis-color-ramp-container">
      <div className="jp-gis-symbology-row">
        <label>Input range</label>
        <div style={{ display: 'flex', gap: 4, flex: '1 0 50%' }}>
          <input
            className="jp-mod-styled"
            type="number"
            placeholder="min"
            value={params.domain[0]}
            onChange={e =>
              update({ domain: [Number(e.target.value), params.domain[1]] })
            }
          />
          <input
            className="jp-mod-styled"
            type="number"
            placeholder="max"
            value={params.domain[1]}
            onChange={e =>
              update({ domain: [params.domain[0], Number(e.target.value)] })
            }
          />
        </div>
      </div>
      <div className="jp-gis-symbology-row">
        <label>Output range</label>
        <div style={{ display: 'flex', gap: 4, flex: '1 0 50%' }}>
          <input
            className="jp-mod-styled"
            type="number"
            placeholder="min"
            value={params.range[0]}
            onChange={e =>
              update({ range: [Number(e.target.value), params.range[1]] })
            }
          />
          <input
            className="jp-mod-styled"
            type="number"
            placeholder="max"
            value={params.range[1]}
            onChange={e =>
              update({ range: [params.range[0], Number(e.target.value)] })
            }
          />
        </div>
      </div>
      <button
        className="jp-Dialog-button jp-mod-accept jp-mod-styled"
        onClick={classify}
      >
        Set stops
      </button>
      {stopRows.length > 0 && (
        <StopContainer
          selectedMethod="radius"
          stopRows={stopRows}
          setStopRows={handleStopRowsChange}
        />
      )}
    </div>
  );
};
