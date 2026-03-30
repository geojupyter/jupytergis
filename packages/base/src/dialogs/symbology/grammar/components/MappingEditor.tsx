import { UUID } from '@lumino/coreutils';
import React from 'react';

import { VectorClassifications } from '@/src/dialogs/symbology/classificationModes';
import ColorRampSelector from '@/src/dialogs/symbology/components/color_ramp/ColorRampSelector';
import RgbaColorPicker from '@/src/dialogs/symbology/components/color_ramp/RgbaColorPicker';
import StopContainer from '@/src/dialogs/symbology/components/color_stops/StopContainer';
import {
  colorToRgba,
  ensureHexColorCode,
  RgbaColor,
} from '@/src/dialogs/symbology/colorRampUtils';
import {
  CATEGORICAL_PALETTE,
  computeDomain,
} from '@/src/dialogs/symbology/grammar/grammarUtils';
import {
  IEncodingRule,
  IScale,
} from '@/src/dialogs/symbology/grammar/types';
import { COLOR_CHANNELS } from '@/src/dialogs/symbology/grammar/grammarUtils';
import { IStopRow } from '@/src/dialogs/symbology/symbologyDialog';
import { ColorRampName } from '../../colorRampUtils';
import { Utils } from '../../symbologyUtils';

type ClassificationMode =
  | 'quantile'
  | 'equal interval'
  | 'jenks'
  | 'pretty'
  | 'logarithmic';

const CLASSIFICATION_MODES: ClassificationMode[] = [
  'equal interval',
  'quantile',
  'jenks',
  'pretty',
  'logarithmic',
];

// ---------------------------------------------------------------------------
// ColorRampScaleEditor
// ---------------------------------------------------------------------------

interface IColorRampScaleEditorProps {
  scale: Extract<IScale, { scheme: 'colorRamp' }>;
  field: string;
  featureProperties: Record<string, Set<any>>;
  onChange: (scale: IScale) => void;
}

const ColorRampScaleEditor: React.FC<IColorRampScaleEditorProps> = ({
  scale,
  field,
  featureProperties,
  onChange,
}) => {
  const autoComputed = computeDomain(featureProperties[field] ?? new Set());
  const domain = scale.domain ?? autoComputed;
  const mode = scale.mode;
  const nShades = scale.nShades;

  const update = (patch: Partial<Extract<IScale, { scheme: 'colorRamp' }>>) => {
    onChange({ ...scale, ...patch });
  };

  const handleClassify = () => {
    const allValues = Array.from(featureProperties[field] ?? new Set());
    const values = allValues.filter(v => Number.isFinite(v));
    if (values.length === 0) {
      return;
    }

    const rangeMin = domain[0];
    const rangeMax = domain[1];
    const rangeValues = [rangeMin, rangeMax];

    let breaks: number[];
    switch (mode) {
      case 'quantile':
        breaks = VectorClassifications.calculateQuantileBreaks(values, nShades);
        break;
      case 'jenks':
        breaks = VectorClassifications.calculateJenksBreaks(values, nShades);
        break;
      case 'equal interval':
        breaks = VectorClassifications.calculateEqualIntervalBreaks(rangeValues, nShades);
        break;
      case 'pretty':
        breaks = VectorClassifications.calculatePrettyBreaks(rangeValues, nShades);
        break;
      case 'logarithmic':
        breaks = VectorClassifications.calculateLogarithmicBreaks(rangeValues, nShades);
        break;
      default:
        return;
    }

    if (breaks.length > 0) {
      breaks[0] = rangeMin;
      breaks[breaks.length - 1] = rangeMax;
    }

    const stopRows = Utils.getValueColorPairs(
      breaks,
      scale.name as ColorRampName,
      nShades,
      scale.reverse,
    );

    const colorStops = stopRows.map(row => ({
      stop: row.stop as number,
      color: row.output as [number, number, number, number],
    }));

    update({ colorStops });
  };

  const stopRows: IStopRow[] = (scale.colorStops ?? []).map(cs => ({
    id: UUID.uuid4(),
    stop: cs.stop,
    output: cs.color as RgbaColor,
  }));

  const handleStopRowsChange = (rows: IStopRow[]) => {
    const colorStops = rows.map(row => ({
      stop: row.stop as number,
      color: row.output as [number, number, number, number],
    }));
    update({ colorStops });
  };

  return (
    <div className="jp-gis-scale-editor jp-gis-color-ramp-container">
      <div className="jp-gis-symbology-row">
        <label>Color Ramp:</label>
        <ColorRampSelector
          selectedRamp={scale.name as ColorRampName}
          setSelected={name => update({ name, colorStops: undefined })}
          reverse={scale.reverse}
          setReverse={action => {
            const reverse =
              typeof action === 'function'
                ? action(scale.reverse)
                : action;
            update({ reverse, colorStops: undefined });
          }}
        />
      </div>

      <div className="jp-gis-symbology-row">
        <label>Mode:</label>
        <div className="jp-select-wrapper">
          <select
            className="jp-mod-styled"
            value={mode}
            onChange={e =>
              update({
                mode: e.target.value as ClassificationMode,
                colorStops: undefined,
              })
            }
          >
            {CLASSIFICATION_MODES.map(m => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="jp-gis-symbology-row">
        <label>Classes:</label>
        <input
          type="number"
          className="jp-mod-styled"
          min={2}
          max={256}
          value={nShades}
          onChange={e =>
            update({
              nShades: Math.max(2, parseInt(e.target.value) || 9),
              colorStops: undefined,
            })
          }
        />
      </div>

      <div className="jp-gis-symbology-row">
        <label>Min:</label>
        <input
          type="number"
          className="jp-mod-styled"
          value={domain[0]}
          onChange={e =>
            update({
              domain: [parseFloat(e.target.value) || 0, domain[1]],
              colorStops: undefined,
            })
          }
        />
        <label>Max:</label>
        <input
          type="number"
          className="jp-mod-styled"
          value={domain[1]}
          onChange={e =>
            update({
              domain: [domain[0], parseFloat(e.target.value) || 1],
              colorStops: undefined,
            })
          }
        />
      </div>

      <button
        className="jp-Dialog-button jp-mod-accept jp-mod-styled"
        onClick={handleClassify}
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
// CategoricalScaleEditor
// ---------------------------------------------------------------------------

interface ICategoricalScaleEditorProps {
  scale: Extract<IScale, { scheme: 'categorical' }>;
  field: string;
  featureProperties: Record<string, Set<any>>;
  onChange: (scale: IScale) => void;
}

const CategoricalScaleEditor: React.FC<ICategoricalScaleEditorProps> = ({
  scale,
  field,
  featureProperties,
  onChange,
}) => {
  const fieldValues = Array.from(featureProperties[field] ?? new Set())
    .filter(v => v !== null && v !== undefined)
    .slice(0, 20);

  const mapping = { ...scale.mapping };
  fieldValues.forEach((v, i) => {
    const key = String(v);
    if (!mapping[key]) {
      mapping[key] = CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length];
    }
  });

  const updateColor = (key: string, color: RgbaColor) => {
    onChange({
      ...scale,
      mapping: { ...mapping, [key]: ensureHexColorCode(color) },
    });
  };

  const updateFallback = (color: RgbaColor) => {
    onChange({ ...scale, fallback: ensureHexColorCode(color) });
  };

  return (
    <div className="jp-gis-scale-editor">
      {fieldValues.length === 0 && (
        <p className="jp-gis-mapping-empty">No values found for this field.</p>
      )}
      {fieldValues.map(v => {
        const key = String(v);
        return (
          <div key={key} className="jp-gis-color-row">
            <span
              className="jp-mod-styled jp-gis-color-row-value-input"
              style={{ display: 'flex', alignItems: 'center' }}
            >
              {key}
            </span>
            <RgbaColorPicker
              color={colorToRgba(mapping[key] ?? '#888888')}
              onChange={color => updateColor(key, color)}
            />
          </div>
        );
      })}
      <div className="jp-gis-color-row">
        <span
          className="jp-mod-styled jp-gis-color-row-value-input"
          style={{ display: 'flex', alignItems: 'center' }}
        >
          Other
        </span>
        <RgbaColorPicker
          color={colorToRgba(scale.fallback ?? '#000000')}
          onChange={updateFallback}
        />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// ScalarScaleEditor
// ---------------------------------------------------------------------------

interface IScalarScaleEditorProps {
  scale: Extract<IScale, { scheme: 'scalar' }>;
  field: string;
  featureProperties: Record<string, Set<any>>;
  onChange: (scale: IScale) => void;
}

const ScalarScaleEditor: React.FC<IScalarScaleEditorProps> = ({
  scale,
  field,
  featureProperties,
  onChange,
}) => {
  const autoComputed = computeDomain(featureProperties[field] ?? new Set());
  const domain = scale.domain ?? autoComputed;
  const mode = scale.mode;
  const nShades = 9;

  const update = (patch: Partial<Extract<IScale, { scheme: 'scalar' }>>) => {
    onChange({ ...scale, ...patch });
  };

  const handleClassify = () => {
    const allValues = Array.from(featureProperties[field] ?? new Set());
    const values = allValues.filter(v => Number.isFinite(v));
    if (values.length === 0) {
      return;
    }

    const rangeValues = [domain[0], domain[1]];
    let breaks: number[];
    switch (mode) {
      case 'quantile':
        breaks = VectorClassifications.calculateQuantileBreaks(values, nShades);
        break;
      case 'jenks':
        breaks = VectorClassifications.calculateJenksBreaks(values, nShades);
        break;
      case 'equal interval':
        breaks = VectorClassifications.calculateEqualIntervalBreaks(rangeValues, nShades);
        break;
      case 'pretty':
        breaks = VectorClassifications.calculatePrettyBreaks(rangeValues, nShades);
        break;
      case 'logarithmic':
        breaks = VectorClassifications.calculateLogarithmicBreaks(rangeValues, nShades);
        break;
      default:
        return;
    }

    if (breaks.length > 0) {
      breaks[0] = domain[0];
      breaks[breaks.length - 1] = domain[1];
    }

    const scalarStops = breaks.map((stop, i) => {
      const t = breaks.length === 1 ? 0 : i / (breaks.length - 1);
      const output = scale.range[0] + t * (scale.range[1] - scale.range[0]);
      return { stop, output };
    });

    update({ scalarStops });
  };

  const stopRows: IStopRow[] = (scale.scalarStops ?? []).map(ss => ({
    id: UUID.uuid4(),
    stop: ss.stop,
    output: ss.output,
  }));

  const handleStopRowsChange = (rows: IStopRow[]) => {
    const scalarStops = rows.map(row => ({
      stop: row.stop as number,
      output: row.output as number,
    }));
    update({ scalarStops });
  };

  return (
    <div className="jp-gis-scale-editor jp-gis-color-ramp-container">
      <div className="jp-gis-symbology-row">
        <label>Mode:</label>
        <div className="jp-select-wrapper">
          <select
            className="jp-mod-styled"
            value={mode}
            onChange={e =>
              update({
                mode: e.target.value as ClassificationMode,
                scalarStops: undefined,
              })
            }
          >
            {CLASSIFICATION_MODES.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="jp-gis-symbology-row">
        <label>Input Min:</label>
        <input
          type="number"
          className="jp-mod-styled"
          value={domain[0]}
          onChange={e =>
            update({ domain: [parseFloat(e.target.value) || 0, domain[1]], scalarStops: undefined })
          }
        />
        <label>Max:</label>
        <input
          type="number"
          className="jp-mod-styled"
          value={domain[1]}
          onChange={e =>
            update({ domain: [domain[0], parseFloat(e.target.value) || 1], scalarStops: undefined })
          }
        />
      </div>

      <div className="jp-gis-symbology-row">
        <label>Output Min:</label>
        <input
          type="number"
          className="jp-mod-styled"
          value={scale.range[0]}
          onChange={e =>
            update({ range: [parseFloat(e.target.value) || 0, scale.range[1]], scalarStops: undefined })
          }
        />
        <label>Max:</label>
        <input
          type="number"
          className="jp-mod-styled"
          value={scale.range[1]}
          onChange={e =>
            update({ range: [scale.range[0], parseFloat(e.target.value) || 1], scalarStops: undefined })
          }
        />
      </div>

      <button
        className="jp-Dialog-button jp-mod-accept jp-mod-styled"
        onClick={handleClassify}
      >
        Classify
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

// ---------------------------------------------------------------------------
// ConstantScaleEditor
// ---------------------------------------------------------------------------

interface IConstantScaleEditorProps {
  scale: Extract<IScale, { scheme: 'constant' }>;
  channel: IEncodingRule['channel'];
  onChange: (scale: IScale) => void;
}

const ConstantScaleEditor: React.FC<IConstantScaleEditorProps> = ({
  scale,
  channel,
  onChange,
}) => {
  const isColorChannel = (COLOR_CHANNELS as string[]).includes(channel);

  if (isColorChannel) {
    // Parse current value as RgbaColor for the picker.
    const currentColor: RgbaColor =
      typeof scale.value === 'string'
        ? colorToRgba(scale.value)
        : Array.isArray(scale.value)
          ? [scale.value[0], scale.value[1], scale.value[2], scale.value[3] ?? 1] as RgbaColor
          : colorToRgba('#888888');

    return (
      <div className="jp-gis-scale-editor">
        <div className="jp-gis-symbology-row">
          <label>Color:</label>
          <RgbaColorPicker
            color={currentColor}
            onChange={color => onChange({ ...scale, value: ensureHexColorCode(color) })}
          />
        </div>
      </div>
    );
  }

  // Numeric channel (stroke-width, circle-radius, circle-stroke-width).
  return (
    <div className="jp-gis-scale-editor">
      <div className="jp-gis-symbology-row">
        <label>Value:</label>
        <input
          type="number"
          className="jp-mod-styled"
          value={typeof scale.value === 'number' ? scale.value : 1}
          min={0}
          onChange={e =>
            onChange({ ...scale, value: parseFloat(e.target.value) || 0 })
          }
        />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// MappingEditor
// ---------------------------------------------------------------------------

interface IMappingEditorProps {
  rule: IEncodingRule;
  featureProperties: Record<string, Set<any>>;
  onChange: (rule: IEncodingRule) => void;
}

const MappingEditor: React.FC<IMappingEditorProps> = ({
  rule,
  featureProperties,
  onChange,
}) => {
  const updateScale = (scale: IScale) => onChange({ ...rule, scale });

  return (
    <div className="jp-gis-mapping-editor">
      {rule.scale.scheme === 'colorRamp' && (
        <ColorRampScaleEditor
          scale={rule.scale}
          field={rule.field ?? ''}
          featureProperties={featureProperties}
          onChange={updateScale}
        />
      )}
      {rule.scale.scheme === 'categorical' && (
        <CategoricalScaleEditor
          scale={rule.scale}
          field={rule.field ?? ''}
          featureProperties={featureProperties}
          onChange={updateScale}
        />
      )}
      {rule.scale.scheme === 'scalar' && (
        <ScalarScaleEditor
          scale={rule.scale}
          field={rule.field ?? ''}
          featureProperties={featureProperties}
          onChange={updateScale}
        />
      )}
      {rule.scale.scheme === 'constant' && (
        <ConstantScaleEditor
          scale={rule.scale}
          channel={rule.channel}
          onChange={updateScale}
        />
      )}
      {rule.scale.scheme === 'identity' && (
        <p className="jp-gis-mapping-empty">
          Field value used directly — no configuration needed.
        </p>
      )}
    </div>
  );
};

export default MappingEditor;
