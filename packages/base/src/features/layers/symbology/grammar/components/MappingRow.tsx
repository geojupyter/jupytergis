/**
 * A single grammar mapping row: field → scale → channels (fan-out tree).
 * The scale preview spans all channel rows. Additional channels branch below.
 * "when" predicates are shown as chips below the grid.
 */

import {
  IColorRampScale,
  IConstantScale,
  IPredicate,
  IScale,
  OLStyleChannel,
  RGBA,
} from '@jupytergis/schema';
import React, { useCallback, useRef, useState } from 'react';

import {
  ColorRampName,
  drawColorRamp,
  getColorMap,
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
  const numericChannels = currentChannels.every(ch =>
    POSFLOAT_CHANNELS.includes(ch),
  );
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
// Display scheme — splits 'constant' into 'constantColor' | 'constantNum'
// ---------------------------------------------------------------------------

type DisplayScheme =
  | Exclude<IScale['scheme'], 'constant'>
  | 'constantColor'
  | 'constantNum';

const DISPLAY_SCHEME_OPTIONS: { value: DisplayScheme; label: string }[] = [
  { value: 'constantColor', label: 'const (color)' },
  { value: 'constantNum', label: 'const (num)' },
  { value: 'colorRamp', label: 'colorRamp' },
  { value: 'categorical', label: 'categorical' },
  { value: 'scalar', label: 'scalar' },
  { value: 'identity', label: 'identity' },
];

function displaySchemeOf(scale: IScale): DisplayScheme {
  if (scale.scheme !== 'constant') {
    return scale.scheme;
  }
  return typeof scale.params.value === 'number'
    ? 'constantNum'
    : 'constantColor';
}

function scaleForDisplayScheme(
  ds: DisplayScheme,
  currentChannels: OLStyleChannel[],
): IScale {
  if (ds === 'constantColor') {
    return {
      scheme: 'constant',
      params: { value: [128, 128, 128, 1] as RGBA },
    } as IConstantScale;
  }
  if (ds === 'constantNum') {
    return { scheme: 'constant', params: { value: 1 } } as IConstantScale;
  }
  return defaultScaleForScheme(ds, currentChannels);
}

// ---------------------------------------------------------------------------
// Scale preview
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
      width={160}
      height={14}
      style={{
        borderRadius: 2,
        flex: '0 0 80px',
        height: 14,
        display: 'block',
      }}
    />
  );
};

const ScalePreview: React.FC<{ scale: IScale }> = ({ scale }) => {
  switch (scale.scheme) {
    case 'constant': {
      const { value } = scale.params;
      if (typeof value === 'number') {
        return (
          <span className="jp-gis-scale-preview">
            <span className="jp-gis-scale-meta">= {value}</span>
          </span>
        );
      }
      const [r, g, b, a] = value as RGBA;
      return (
        <span className="jp-gis-scale-preview">
          <span
            className="jp-gis-scale-swatch"
            style={{ background: `rgba(${r},${g},${b},${a})` }}
          />
          <span className="jp-gis-scale-meta">
            {r}, {g}, {b}, {a}
          </span>
        </span>
      );
    }
    case 'colorRamp': {
      const { name, reverse, domain } = scale.params;
      return (
        <span className="jp-gis-scale-preview">
          <ColorRampPreview name={name} reverse={reverse} />
          <span className="jp-gis-scale-meta">
            {name}
            {domain ? ` [${domain[0]}–${domain[1]}]` : ''}
          </span>
        </span>
      );
    }
    case 'categorical': {
      const { colorRamp, colorStops } = scale.params;
      if (colorStops?.length) {
        return (
          <span className="jp-gis-scale-preview">
            {colorStops.slice(0, 8).map((s, i) => {
              const [r, g, b, aa] = s.color;
              return (
                <span
                  key={i}
                  className="jp-gis-scale-dot"
                  style={{ background: `rgba(${r},${g},${b},${aa})` }}
                />
              );
            })}
            <span className="jp-gis-scale-meta">{colorRamp}</span>
          </span>
        );
      }
      return (
        <span className="jp-gis-scale-preview">
          <span className="jp-gis-scale-meta">
            {colorRamp ?? 'categorical'}
          </span>
        </span>
      );
    }
    case 'scalar': {
      const { domain, range } = scale.params;
      return (
        <span className="jp-gis-scale-preview">
          <span className="jp-gis-scale-meta">
            [{domain[0]}, {domain[1]}] → [{range[0]}, {range[1]}]
          </span>
        </span>
      );
    }
    case 'identity':
      return (
        <span className="jp-gis-scale-preview">
          <span className="jp-gis-scale-meta">∘ identity</span>
        </span>
      );
    case 'kde':
      return (
        <span className="jp-gis-scale-preview">
          <span className="jp-gis-scale-meta">kde</span>
        </span>
      );
    default:
      return null;
  }
};

// ---------------------------------------------------------------------------
// When-clause helpers
// ---------------------------------------------------------------------------

function formatPredicate(pred: IPredicate): string {
  switch (pred.type) {
    case 'geometryType':
      return `geom = ${pred.value}`;
    case 'hasField':
      return `has: ${pred.field}`;
    case 'fieldEquals':
      return `${pred.field} = ${pred.value}`;
  }
}

type PredicateType = IPredicate['type'];

interface INewPredicate {
  type: PredicateType;
  geomValue: 'Point' | 'LineString' | 'Polygon';
  field: string;
  fieldValue: string;
}

const EMPTY_NEW: INewPredicate = {
  type: 'geometryType',
  geomValue: 'Point',
  field: '',
  fieldValue: '',
};

function buildPredicate(p: INewPredicate): IPredicate | null {
  switch (p.type) {
    case 'geometryType':
      return { type: 'geometryType', value: p.geomValue };
    case 'hasField':
      return p.field ? { type: 'hasField', field: p.field } : null;
    case 'fieldEquals':
      return p.field
        ? {
            type: 'fieldEquals',
            field: p.field,
            value: isNaN(Number(p.fieldValue))
              ? p.fieldValue
              : Number(p.fieldValue),
          }
        : null;
  }
}

interface IWhenAddFormProps {
  availableFields: string[];
  onAdd: (pred: IPredicate) => void;
  onCancel: () => void;
}

const WhenAddForm: React.FC<IWhenAddFormProps> = ({
  availableFields,
  onAdd,
  onCancel,
}) => {
  const [draft, setDraft] = useState<INewPredicate>({ ...EMPTY_NEW });

  const patch = (p: Partial<INewPredicate>) =>
    setDraft(prev => ({ ...prev, ...p }));

  const built = buildPredicate(draft);

  return (
    <span className="jp-gis-grammar-when-form">
      <div className="jp-select-wrapper" style={{ flex: '0 0 auto' }}>
        <select
          className="jp-mod-styled"
          value={draft.type}
          onChange={e => patch({ type: e.target.value as PredicateType })}
        >
          <option value="geometryType">geometry type</option>
          <option value="hasField">has field</option>
          <option value="fieldEquals">field equals</option>
        </select>
      </div>

      {draft.type === 'geometryType' && (
        <div className="jp-select-wrapper" style={{ flex: '0 0 auto' }}>
          <select
            className="jp-mod-styled"
            value={draft.geomValue}
            onChange={e =>
              patch({
                geomValue: e.target.value as INewPredicate['geomValue'],
              })
            }
          >
            <option value="Point">Point</option>
            <option value="LineString">LineString</option>
            <option value="Polygon">Polygon</option>
          </select>
        </div>
      )}

      {(draft.type === 'hasField' || draft.type === 'fieldEquals') && (
        <div className="jp-select-wrapper" style={{ flex: '0 0 auto' }}>
          <select
            className="jp-mod-styled"
            value={draft.field}
            onChange={e => patch({ field: e.target.value })}
          >
            <option value="">(field)</option>
            {availableFields.map(f => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
      )}

      {draft.type === 'fieldEquals' && (
        <input
          className="jp-mod-styled"
          style={{ flex: '0 0 80px', minWidth: 0 }}
          type="text"
          placeholder="value"
          value={draft.fieldValue}
          onChange={e => patch({ fieldValue: e.target.value })}
        />
      )}

      <button
        className="jp-gis-grammar-when-ok"
        disabled={!built}
        onClick={() => built && onAdd(built)}
        title="Add predicate"
      >
        ✓
      </button>
      <button
        className="jp-gis-grammar-when-cancel"
        onClick={onCancel}
        title="Cancel"
      >
        ✗
      </button>
    </span>
  );
};

// ---------------------------------------------------------------------------
// Row data
// ---------------------------------------------------------------------------

export interface IGrammarRow {
  id: string;
  field?: string;
  scale: IScale;
  channels: OLStyleChannel[];
  when?: IPredicate[];
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
  const [addingWhen, setAddingWhen] = useState(false);

  const handleFieldChange = useCallback(
    (field: string) => onChange({ ...row, field: field || undefined }),
    [row, onChange],
  );

  const handleSchemeChange = useCallback(
    (ds: DisplayScheme) => {
      const newScale = scaleForDisplayScheme(ds, row.channels);
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

  const handleChannelChange = useCallback(
    (index: number, ch: OLStyleChannel) => {
      const next = [...row.channels];
      next[index] = ch;
      onChange({ ...row, channels: next });
    },
    [row, onChange],
  );

  const removeChannel = useCallback(
    (ch: OLStyleChannel) => {
      const next = row.channels.filter(c => c !== ch);
      if (next.length > 0) {
        onChange({ ...row, channels: next });
      } else {
        onDelete();
      }
    },
    [row, onChange, onDelete],
  );

  const addChannel = useCallback(
    (ch: OLStyleChannel) => {
      onChange({ ...row, channels: [...row.channels, ch] });
    },
    [row, onChange],
  );

  const addPredicate = useCallback(
    (pred: IPredicate) => {
      onChange({ ...row, when: [...(row.when ?? []), pred] });
      setAddingWhen(false);
    },
    [row, onChange],
  );

  const removePredicate = useCallback(
    (index: number) => {
      const next = (row.when ?? []).filter((_, i) => i !== index);
      onChange({ ...row, when: next.length > 0 ? next : undefined });
    },
    [row, onChange],
  );

  const compat = compatibleChannels(row.scale);
  const availableToAdd = compat.filter(ch => !row.channels.includes(ch));
  const previewRowSpan =
    row.channels.length + (availableToAdd.length > 0 ? 1 : 0);

  return (
    <div className="jp-gis-grammar-rule">
      {/* CSS grid: col1=field col2=scheme col3=preview col4=arrow col5=channel col6=× */}
      <div className="jp-gis-grammar-rule-grid">
        {/* Field — row 1 */}
        <div
          className="jp-select-wrapper"
          style={{ gridRow: 1, gridColumn: 1 }}
        >
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

        {/* Scheme — row 1 */}
        <div
          className="jp-select-wrapper"
          style={{ gridRow: 1, gridColumn: 2 }}
        >
          <select
            className="jp-mod-styled"
            value={displaySchemeOf(row.scale)}
            onChange={e => handleSchemeChange(e.target.value as DisplayScheme)}
          >
            {DISPLAY_SCHEME_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Scale preview — spans all channel rows + optional add-channel row */}
        <button
          className="jp-gis-grammar-preview-btn"
          style={{ gridRow: `1 / span ${previewRowSpan}`, gridColumn: 3 }}
          onClick={() => setExpanded(v => !v)}
          title={expanded ? 'Collapse editor' : 'Edit scale'}
        >
          <ScalePreview scale={row.scale} />
        </button>

        {/* Per-channel rows */}
        {row.channels.map((ch, i) => (
          <React.Fragment key={`${ch}-${i}`}>
            <span
              className="jp-gis-grammar-arrow"
              style={{ gridRow: i + 1, gridColumn: 4 }}
            >
              →
            </span>
            <div
              className="jp-select-wrapper"
              style={{ gridRow: i + 1, gridColumn: 5 }}
            >
              <select
                className="jp-mod-styled"
                value={ch}
                onChange={e =>
                  handleChannelChange(i, e.target.value as OLStyleChannel)
                }
              >
                {compat.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="jp-gis-grammar-delete-btn"
              style={{ gridRow: i + 1, gridColumn: 6 }}
              onClick={() => removeChannel(ch)}
              title={
                row.channels.length === 1 ? 'Remove mapping' : 'Remove channel'
              }
            >
              ×
            </button>
          </React.Fragment>
        ))}

        {/* Add channel row */}
        {availableToAdd.length > 0 && (
          <React.Fragment>
            <span
              className="jp-gis-grammar-arrow"
              style={{ gridRow: row.channels.length + 1, gridColumn: 4 }}
            >
              +
            </span>
            <div
              className="jp-select-wrapper"
              style={{ gridRow: row.channels.length + 1, gridColumn: 5 }}
            >
              <select
                className="jp-mod-styled"
                value=""
                onChange={e => {
                  if (e.target.value) {
                    addChannel(e.target.value as OLStyleChannel);
                  }
                }}
              >
                <option value="">(add channel)</option>
                {availableToAdd.map(ch => (
                  <option key={ch} value={ch}>
                    {ch}
                  </option>
                ))}
              </select>
            </div>
          </React.Fragment>
        )}
      </div>

      {/* When clause */}
      <div className="jp-gis-grammar-when-row">
        <span className="jp-gis-grammar-when-label">when</span>
        {row.when?.map((pred, i) => (
          <span key={i} className="jp-gis-grammar-when-chip">
            {formatPredicate(pred)}
            <button onClick={() => removePredicate(i)} title="Remove condition">
              ×
            </button>
          </span>
        ))}
        {addingWhen ? (
          <WhenAddForm
            availableFields={availableFields}
            onAdd={addPredicate}
            onCancel={() => setAddingWhen(false)}
          />
        ) : (
          <button
            className="jp-gis-grammar-when-add-btn"
            onClick={() => setAddingWhen(true)}
          >
            + add
          </button>
        )}
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
