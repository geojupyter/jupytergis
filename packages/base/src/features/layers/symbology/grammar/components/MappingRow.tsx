/**
 * A single grammar mapping row: field → scale → channels.
 * The row header is always visible; clicking it expands the inline scale editor.
 * Fan-out: channels is a multi-value set shown as removable chips.
 */

import {
  IColorRampScale,
  IConstantScale,
  IScale,
  OLStyleChannel,
  RGBA,
} from '@jupytergis/schema';
import React, { useCallback, useRef, useState } from 'react';

import {
  drawColorRamp,
  getColorMap,
  ColorRampName,
} from '@/src/features/layers/symbology/colorRampUtils';
import {
  CategoricalEditor,
  ColorRampEditor,
  ConstantEditor,
  ScalarEditor,
} from './ScaleEditor';

// ---------------------------------------------------------------------------
// Channel taxonomy
// ---------------------------------------------------------------------------

const RGBA_CHANNELS: OLStyleChannel[] = [
  'fill-color',
  'stroke-color',
  'circle-fill-color',
  'circle-stroke-color',
];
const POSFLOAT_CHANNELS: OLStyleChannel[] = [
  'stroke-width',
  'circle-stroke-width',
  'circle-radius',
];
const ALL_CHANNELS = [...RGBA_CHANNELS, ...POSFLOAT_CHANNELS];

function isPosfloat(ch: OLStyleChannel): boolean {
  return POSFLOAT_CHANNELS.includes(ch);
}

function compatibleChannels(scale: IScale): OLStyleChannel[] {
  switch (scale.scheme) {
    case 'colorRamp':
    case 'categorical':
    case 'kde':
      return RGBA_CHANNELS;
    case 'scalar':
      return POSFLOAT_CHANNELS;
    case 'constant': {
      const { value } = scale.params;
      return typeof value === 'number' ? POSFLOAT_CHANNELS : RGBA_CHANNELS;
    }
    default:
      return ALL_CHANNELS;
  }
}

function defaultScaleForScheme(
  scheme: IScale['scheme'],
  currentChannels: OLStyleChannel[],
): IScale {
  const numericChannels = currentChannels.every(isPosfloat);
  switch (scheme) {
    case 'constant':
      return numericChannels
        ? ({ scheme: 'constant', params: { value: 1 } } as IConstantScale)
        : ({
            scheme: 'constant',
            params: { value: [128, 128, 128, 1] as RGBA },
          } as IConstantScale);
    case 'colorRamp':
      return {
        scheme: 'colorRamp',
        params: {
          name: 'viridis',
          nShades: 9,
          mode: 'equal interval',
          reverse: false,
          fallback: [0, 0, 0, 0] as RGBA,
        },
      } as IColorRampScale;
    case 'categorical':
      return {
        scheme: 'categorical',
        params: {
          colorRamp: 'viridis',
          reverse: false,
          fallback: [0, 0, 0, 0] as RGBA,
        },
      };
    case 'scalar':
      return {
        scheme: 'scalar',
        params: {
          domain: [0, 100],
          range: [1, 20],
          mode: 'equal interval',
          nStops: 5,
          fallback: 1,
        },
      };
    case 'identity':
      return { scheme: 'identity' };
    default:
      return { scheme: 'constant', params: { value: 1 } } as IConstantScale;
  }
}

// ---------------------------------------------------------------------------
// Compact scale preview
// ---------------------------------------------------------------------------

const ColorRampPreview: React.FC<{ name: string; reverse: boolean }> = ({
  name,
  reverse,
}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas) {
      return;
    }
    const colorMap = getColorMap(name as ColorRampName);
    if (!colorMap) {
      return;
    }
    const map = reverse
      ? { ...colorMap, colors: [...colorMap.colors].reverse() }
      : colorMap;
    drawColorRamp(canvas, map);
  }, [name, reverse]);
  return (
    <canvas
      ref={ref}
      width={60}
      height={14}
      style={{ borderRadius: 2, display: 'block' }}
    />
  );
};

const ScalePreview: React.FC<{ scale: IScale }> = ({ scale }) => {
  switch (scale.scheme) {
    case 'constant': {
      const { value } = scale.params;
      if (typeof value === 'number') {
        return <span className="jp-gis-scale-preview">= {value}</span>;
      }
      const [r, g, b, a] = value as RGBA;
      return (
        <span
          className="jp-gis-scale-preview"
          style={{ background: `rgba(${r},${g},${b},${a})`, minWidth: 20 }}
        />
      );
    }
    case 'colorRamp':
      return (
        <span className="jp-gis-scale-preview jp-gis-scale-preview-ramp">
          <ColorRampPreview
            name={scale.params.name}
            reverse={scale.params.reverse}
          />
        </span>
      );
    case 'categorical':
      return <span className="jp-gis-scale-preview">cat</span>;
    case 'scalar':
      return <span className="jp-gis-scale-preview">↕</span>;
    case 'identity':
      return <span className="jp-gis-scale-preview">∘</span>;
    case 'kde':
      return <span className="jp-gis-scale-preview">kde</span>;
  }
};

// ---------------------------------------------------------------------------
// Row data
// ---------------------------------------------------------------------------

export interface IGrammarRow {
  id: string;
  field?: string;
  scale: IScale;
  channels: OLStyleChannel[];
}

interface IMappingRowProps {
  row: IGrammarRow;
  availableFields: string[];
  featureValues: Record<string, Set<any>>;
  onChange: (row: IGrammarRow) => void;
  onDelete: () => void;
}

// ---------------------------------------------------------------------------
// MappingRow
// ---------------------------------------------------------------------------

const MappingRow: React.FC<IMappingRowProps> = ({
  row,
  availableFields,
  featureValues,
  onChange,
  onDelete,
}) => {
  const [expanded, setExpanded] = useState(false);

  const handleFieldChange = useCallback(
    (field: string) => onChange({ ...row, field: field || undefined }),
    [row, onChange],
  );

  const handleSchemeChange = useCallback(
    (scheme: IScale['scheme']) => {
      const newScale = defaultScaleForScheme(scheme, row.channels);
      const compat = compatibleChannels(newScale);
      const filtered = row.channels.filter(ch => compat.includes(ch));
      onChange({
        ...row,
        scale: newScale,
        channels: filtered.length > 0 ? filtered : [compat[0]],
      });
    },
    [row, onChange],
  );

  const handleScaleChange = useCallback(
    (scale: IScale) => onChange({ ...row, scale }),
    [row, onChange],
  );

  const removeChannel = useCallback(
    (ch: OLStyleChannel) => {
      const next = row.channels.filter(c => c !== ch);
      if (next.length > 0) {
        onChange({ ...row, channels: next });
      }
    },
    [row, onChange],
  );

  const addChannel = useCallback(
    (ch: OLStyleChannel) => {
      if (!row.channels.includes(ch)) {
        onChange({ ...row, channels: [...row.channels, ch] });
      }
    },
    [row, onChange],
  );

  const compat = compatibleChannels(row.scale);
  const availableToAdd = compat.filter(ch => !row.channels.includes(ch));

  const SCHEME_OPTIONS: IScale['scheme'][] = [
    'constant',
    'colorRamp',
    'categorical',
    'scalar',
    'identity',
  ];

  return (
    <div className="jp-gis-grammar-rule">
      {/* Header row */}
      <div className="jp-gis-grammar-rule-header">
        {/* Field selector */}
        <div className="jp-select-wrapper" style={{ flex: '0 0 110px' }}>
          <select
            className="jp-mod-styled"
            value={row.field ?? ''}
            onChange={e => handleFieldChange(e.target.value)}
          >
            <option value="">(none)</option>
            {availableFields.map(f => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        {/* Scheme selector */}
        <div className="jp-select-wrapper" style={{ flex: '0 0 100px' }}>
          <select
            className="jp-mod-styled"
            value={row.scale.scheme}
            onChange={e =>
              handleSchemeChange(e.target.value as IScale['scheme'])
            }
          >
            {SCHEME_OPTIONS.map(s => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Scale preview — click to expand editor */}
        <button
          className="jp-gis-grammar-preview-btn"
          onClick={() => setExpanded(v => !v)}
          title={expanded ? 'Collapse editor' : 'Edit scale'}
        >
          <ScalePreview scale={row.scale} />
        </button>

        <span style={{ flexShrink: 0, color: 'var(--jp-ui-font-color2)' }}>
          →
        </span>

        {/* Channel chips */}
        <div className="jp-gis-grammar-channels">
          {row.channels.map(ch => (
            <span key={ch} className="jp-gis-grammar-channel-chip">
              {ch}
              <button onClick={() => removeChannel(ch)} title="Remove channel">
                ×
              </button>
            </span>
          ))}
          {availableToAdd.length > 0 && (
            <select
              className="jp-mod-styled jp-gis-grammar-add-channel"
              value=""
              onChange={e => {
                if (e.target.value) {
                  addChannel(e.target.value as OLStyleChannel);
                }
              }}
            >
              <option value="">+</option>
              {availableToAdd.map(ch => (
                <option key={ch} value={ch}>
                  {ch}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Delete button */}
        <button
          className="jp-gis-grammar-delete-btn"
          onClick={onDelete}
          title="Remove mapping"
        >
          ×
        </button>
      </div>

      {/* Inline scale editor */}
      {expanded && (
        <div className="jp-gis-grammar-rule-editor">
          {row.scale.scheme === 'constant' && (
            <ConstantEditor
              scale={row.scale}
              channels={row.channels}
              onChange={handleScaleChange}
            />
          )}
          {row.scale.scheme === 'colorRamp' && (
            <ColorRampEditor
              scale={row.scale}
              field={row.field}
              featureValues={featureValues}
              onChange={handleScaleChange}
            />
          )}
          {row.scale.scheme === 'categorical' && (
            <CategoricalEditor
              scale={row.scale}
              field={row.field}
              featureValues={featureValues}
              onChange={handleScaleChange}
            />
          )}
          {row.scale.scheme === 'scalar' && (
            <ScalarEditor
              scale={row.scale}
              field={row.field}
              featureValues={featureValues}
              onChange={handleScaleChange}
            />
          )}
          {(row.scale.scheme === 'identity' || row.scale.scheme === 'kde') && (
            <p
              style={{
                margin: 0,
                color: 'var(--jp-ui-font-color2)',
                fontSize: 'var(--jp-ui-font-size1)',
              }}
            >
              No configuration for {row.scale.scheme} scale.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default MappingRow;
