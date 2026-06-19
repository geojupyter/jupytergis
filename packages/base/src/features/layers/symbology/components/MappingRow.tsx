/**
 * A single grammar mapping row: field → scale → channels (fan-out tree).
 * The scale preview spans all channel rows. Additional channels branch below.
 * "when" predicates are shown as chips below the grid.
 */

import {
  faCheck,
  faPlus,
  faTrash,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  IColorRampScale,
  ICompareOp,
  IConstantNumScale,
  IConstantRGBAScale,
  IPredicate,
  IScale,
  Encoding,
  RGBA,
} from '@jupytergis/schema';
import React, { useCallback, useRef, useState } from 'react';

import {
  ColorRampName,
  drawColorRamp,
  getColorMap,
} from '@/src/features/layers/symbology/colorRampUtils';
import { Button } from '@/src/shared/components/Button';
import { Input } from '@/src/shared/components/Input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/src/shared/components/NativeSelect';
import {
  CategoricalEditor,
  ColorRampEditor,
  ConstantEditor,
  ScalarEditor,
  ExpressionEditor,
} from './ScaleEditor';

// ---------------------------------------------------------------------------
// Channel taxonomy
// ---------------------------------------------------------------------------

const RGBA_CHANNELS: Encoding[] = [
  'fill-color',
  'stroke-color',
  'circle-fill-color',
  'circle-stroke-color',
];
const POSFLOAT_CHANNELS: Encoding[] = [
  'stroke-width',
  'circle-stroke-width',
  'circle-radius',
];
const ALL_CHANNELS = [...RGBA_CHANNELS, ...POSFLOAT_CHANNELS];

// Channels relevant for raster/KDE layers.
// pixel-color: full RGBA including alpha (label: "pixel-rgba").
// pixel-rgb:   virtual channel — RGB only; pair with pixel-alpha for separate alpha.
// pixel-alpha: alpha sub-channel (0-1 scalar).
const PIXEL_RGBA_CHANNELS: Encoding[] = [
  'pixel-color',
  'pixel-rgb',
  'pixel-red',
  'pixel-green',
  'pixel-blue',
];
const PIXEL_FLOAT_CHANNELS: Encoding[] = [
  'pixel-red',
  'pixel-green',
  'pixel-blue',
  'pixel-alpha',
];
const ALL_PIXEL_CHANNELS = Array.from(
  new Set([...PIXEL_RGBA_CHANNELS, ...PIXEL_FLOAT_CHANNELS]),
);

/** Display labels for channels that need a friendlier name. */
const CHANNEL_LABELS: Partial<Record<Encoding, string>> = {
  'pixel-color': 'pixel-rgba',
};

function compatibleChannels(scale: IScale, isRaster = false): Encoding[] {
  if (isRaster) {
    switch (scale.scheme) {
      case 'colorRamp':
      case 'categorical':
      case 'constant_rgba':
        return PIXEL_RGBA_CHANNELS;
      case 'scalar':
      case 'constant_num':
        return PIXEL_FLOAT_CHANNELS;
      default:
        return ALL_PIXEL_CHANNELS;
    }
  }
  switch (scale.scheme) {
    case 'colorRamp':
    case 'categorical':
    case 'constant_rgba':
      return RGBA_CHANNELS;
    case 'scalar':
    case 'constant_num':
      return POSFLOAT_CHANNELS;
    default:
      return ALL_CHANNELS;
  }
}

function defaultScaleForScheme(
  scheme: IScale['scheme'],
  _currentChannels: Encoding[],
): IScale {
  switch (scheme) {
    case 'constant_rgba':
      return {
        scheme: 'constant_rgba',
        params: { value: [128, 128, 128, 1] as RGBA },
      } as IConstantRGBAScale;
    case 'constant_num':
      return {
        scheme: 'constant_num',
        params: { value: 1 },
      } as IConstantNumScale;
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
          colorRamp: 'schemeCategory10',
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
          fallback: 1,
        },
      };
    case 'identity':
      return { scheme: 'identity' };
    default:
      return {
        scheme: 'constant_num',
        params: { value: 1 },
      } as IConstantNumScale;

    case 'expression':
      return {
        scheme: 'expression',
        params: {
          expr: '',
          fallback: [0, 0, 0, 0] as RGBA,
        },
      };
  }
}

// ---------------------------------------------------------------------------
// Scheme selector options
// ---------------------------------------------------------------------------

const SCHEME_OPTIONS: {
  value: IScale['scheme'];
  label: string;
  disabled?: boolean;
}[] = [
  { value: 'constant_rgba', label: 'const (color)' },
  { value: 'constant_num', label: 'const (num)' },
  { value: 'colorRamp', label: 'color map' },
  { value: 'categorical', label: 'categorical' },
  { value: 'scalar', label: 'scalar' },
  { value: 'identity', label: 'identity' },
  { value: 'expression', label: 'expression' },
];

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
    case 'constant_rgba': {
      const [r, g, b, a] = scale.params.value;
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
    case 'constant_num':
      return (
        <span className="jp-gis-scale-preview">
          <span className="jp-gis-scale-meta">= {scale.params.value}</span>
        </span>
      );
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
    case 'expression':
      return (
        <span className="jp-gis-scale-preview">
          <span className="jp-gis-scale-meta">expression</span>
        </span>
      );
    default:
      return null;
  }
};

// ---------------------------------------------------------------------------
// When-clause helpers
// ---------------------------------------------------------------------------

export function formatPredicate(pred: IPredicate): string {
  switch (pred.type) {
    case 'geometryType':
      return `geom = ${pred.value}`;
    case 'hasField':
      return `has: ${pred.field}`;
    case 'fieldEquals':
      return `${pred.field} = ${pred.value}`;
    case 'fieldCompare':
      return `${pred.field} ${pred.op} ${pred.value}`;
    case 'between':
      return `${pred.field} between ${pred.min} and ${pred.max}`;
    default:
      throw new Error(`Invalid predicate type ${pred}`);
  }
}

type PredicateType = IPredicate['type'];

const COMPARE_OPS: ICompareOp[] = ['>', '<', '>=', '<=', '!='];

interface INewPredicate {
  type: PredicateType;
  geomValue: 'Point' | 'LineString' | 'Polygon';
  field: string;
  fieldValue: string;
  compareOp: ICompareOp;
  betweenMin: string;
  betweenMax: string;
}

const EMPTY_NEW: INewPredicate = {
  type: 'geometryType',
  geomValue: 'Point',
  field: '',
  fieldValue: '',
  compareOp: '>',
  betweenMin: '',
  betweenMax: '',
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
    case 'fieldCompare': {
      const num = Number(p.fieldValue);
      return p.field && !isNaN(num)
        ? { type: 'fieldCompare', field: p.field, op: p.compareOp, value: num }
        : null;
    }
    case 'between': {
      const min = Number(p.betweenMin);
      const max = Number(p.betweenMax);
      return p.field &&
        !isNaN(min) &&
        !isNaN(max) &&
        p.betweenMin !== '' &&
        p.betweenMax !== ''
        ? { type: 'between', field: p.field, min, max }
        : null;
    }
    default:
      throw new Error(`Invalid predicate type ${p.type}`);
  }
}

interface IWhenAddFormProps {
  availableFields: string[];
  onAdd: (pred: IPredicate) => void;
  onCancel: () => void;
}

export const WhenAddForm: React.FC<IWhenAddFormProps> = ({
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
      <NativeSelect
        value={draft.type}
        onChange={e => patch({ type: e.target.value as PredicateType })}
      >
        <NativeSelectOption value="geometryType">
          Geometry Type
        </NativeSelectOption>
        <NativeSelectOption value="hasField">Has Field</NativeSelectOption>
        <NativeSelectOption value="fieldEquals">
          Field Equals
        </NativeSelectOption>
        <NativeSelectOption value="fieldCompare">
          Field Compare
        </NativeSelectOption>
        <NativeSelectOption value="between">Between</NativeSelectOption>
      </NativeSelect>

      {draft.type === 'geometryType' && (
        <NativeSelect
          value={draft.geomValue}
          onChange={e =>
            patch({
              geomValue: e.target.value as INewPredicate['geomValue'],
            })
          }
        >
          <NativeSelectOption value="Point">Point</NativeSelectOption>
          <NativeSelectOption value="LineString">LineString</NativeSelectOption>
          <NativeSelectOption value="Polygon">Polygon</NativeSelectOption>
        </NativeSelect>
      )}

      {(draft.type === 'hasField' ||
        draft.type === 'fieldEquals' ||
        draft.type === 'fieldCompare' ||
        draft.type === 'between') && (
        <NativeSelect
          value={draft.field}
          onChange={e => patch({ field: e.target.value })}
        >
          <NativeSelectOption value="">(field)</NativeSelectOption>
          {availableFields.map(field => (
            <NativeSelectOption key={field} value={field}>
              {field}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      )}

      {draft.type === 'fieldCompare' && (
        <NativeSelect
          value={draft.compareOp}
          onChange={e => patch({ compareOp: e.target.value as ICompareOp })}
        >
          {COMPARE_OPS.map(op => (
            <NativeSelectOption key={op} value={op}>
              {op}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      )}

      {(draft.type === 'fieldEquals' || draft.type === 'fieldCompare') && (
        <Input
          style={{ flex: '0 0 80px', minWidth: 0 }}
          type={draft.type === 'fieldCompare' ? 'number' : 'text'}
          placeholder="value"
          value={draft.fieldValue}
          onChange={e => patch({ fieldValue: e.target.value })}
        />
      )}

      {draft.type === 'between' && (
        <>
          <Input
            style={{ flex: '0 0 60px', minWidth: 0 }}
            type="number"
            placeholder="min"
            value={draft.betweenMin}
            onChange={e => patch({ betweenMin: e.target.value })}
          />
          <span
            style={{ flex: '0 0 auto', fontSize: 'var(--jp-ui-font-size0)' }}
          >
            –
          </span>
          <Input
            style={{ flex: '0 0 60px', minWidth: 0 }}
            type="number"
            placeholder="max"
            value={draft.betweenMax}
            onChange={e => patch({ betweenMax: e.target.value })}
          />
        </>
      )}

      <Button
        type="button"
        variant="icon"
        size="icon-md"
        disabled={!built}
        onClick={() => built && onAdd(built)}
        title="Add predicate"
      >
        <FontAwesomeIcon icon={faCheck} />
      </Button>
      <Button
        type="button"
        variant="icon"
        size="icon-md"
        className="jp-gis-grammar-when-form-cancel"
        onClick={onCancel}
        title="Cancel"
      >
        <FontAwesomeIcon icon={faXmark} />
      </Button>
    </span>
  );
};

// ---------------------------------------------------------------------------
// Field selector
// ---------------------------------------------------------------------------

interface IFieldSelectorProps {
  fieldCount: 0 | 1 | 'any';
  fields: string[];
  availableFields: string[];
  onFieldChange: (index: number, value: string) => void;
  onAddField: (value: string) => void;
}

/**
 * Renders the field input area in column 1 of the grid.
 *   0   → "(const)" label, no selection
 *   1   → single dropdown
 *  'any'→ chips for each selected field + add dropdown
 */
const FieldSelector: React.FC<IFieldSelectorProps> = ({
  fieldCount,
  fields,
  availableFields,
  onFieldChange,
  onAddField,
}) => {
  if (fieldCount === 0) {
    return (
      <span
        style={{
          gridRow: 1,
          gridColumn: 1,
          display: 'flex',
          alignItems: 'center',
          fontSize: 'var(--jp-ui-font-size1)',
          color: 'var(--jp-ui-font-color2)',
          paddingLeft: 4,
        }}
      >
        (const)
      </span>
    );
  }

  if (fieldCount === 1) {
    const selectedField = fields[0] ?? '';
    return (
      <div style={{ gridRow: 1, gridColumn: 1 }}>
        <NativeSelect
          value={selectedField}
          onChange={e => onFieldChange(0, e.target.value)}
        >
          <NativeSelectOption value="">(none)</NativeSelectOption>
          {availableFields.map(f => (
            <NativeSelectOption key={f} value={f}>
              {f}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
    );
  }

  // 'any' — multi-field chips + add
  return (
    <div
      style={{
        gridRow: 1,
        gridColumn: 1,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 2,
        alignItems: 'center',
      }}
    >
      {fields.map((f, i) => (
        <span key={i} className="jp-gis-grammar-when-chip">
          {f}
          <Button
            type="button"
            className="jp-gis-grammar-when-cancel"
            onClick={() => onFieldChange(i, '')}
            title="Remove field"
          >
            <FontAwesomeIcon icon={faXmark} />
          </Button>
        </span>
      ))}
      <div style={{ minWidth: 60, flex: '0 0 auto' }}>
        <NativeSelect
          value=""
          onChange={e => {
            if (e.target.value) {
              onAddField(e.target.value);
            }
          }}
        >
          <NativeSelectOption value="">+field</NativeSelectOption>
          {availableFields
            .filter(f => !fields.includes(f))
            .map(f => (
              <NativeSelectOption key={f} value={f}>
                {f}
              </NativeSelectOption>
            ))}
        </NativeSelect>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Row data
// ---------------------------------------------------------------------------

export interface IGrammarRow {
  id: string;
  /** Selected input field(s). Length is governed by fieldCountForScale(scale). */
  fields?: string[];
  scale: IScale;
  channels: Encoding[];
  when?: IPredicate[];
  whenOp?: 'all' | 'any';
}

/**
 * How many input fields a scale accepts.
 *   0    — constants (no field selector shown)
 *   1    — all single-field scales
 *  'any' — multi-field (expression scale, sub-channel assembly)
 */
export function fieldCountForScale(scheme: IScale['scheme']): 0 | 1 | 'any' {
  switch (scheme) {
    case 'constant_rgba':
    case 'constant_num':
      return 0;
    case 'expression':
      return 'any';
    default:
      return 1;
  }
}

interface IMappingRowProps {
  row: IGrammarRow;
  availableFields: string[];
  featureValues: Record<string, Set<any>>;
  isRaster?: boolean;
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
  isRaster = false,
  onChange,
  onDelete,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [addingWhen, setAddingWhen] = useState(false);

  const handleFieldChange = useCallback(
    (index: number, value: string) => {
      const next = [...(row.fields ?? [])];
      if (value) {
        next[index] = value;
      } else {
        next.splice(index, 1);
      }
      onChange({ ...row, fields: next.length > 0 ? next : undefined });
    },
    [row, onChange],
  );

  const addField = useCallback(
    (value: string) => {
      if (!value) {
        return;
      }
      onChange({ ...row, fields: [...(row.fields ?? []), value] });
    },
    [row, onChange],
  );

  const handleSchemeChange = useCallback(
    (scheme: IScale['scheme']) => {
      const newScale = defaultScaleForScheme(scheme, row.channels);
      const compat = compatibleChannels(newScale, isRaster);
      const filtered = row.channels.filter(ch => compat.includes(ch));
      const newFieldCount = fieldCountForScale(scheme);
      // Trim fields list to match new count constraint
      const trimmedFields =
        newFieldCount === 0
          ? undefined
          : newFieldCount === 1
            ? row.fields?.slice(0, 1)
            : row.fields;
      onChange({
        ...row,
        scale: newScale,
        channels: filtered.length > 0 ? filtered : [compat[0]],
        fields: trimmedFields,
      });
    },
    [row, onChange],
  );

  const handleScaleChange = useCallback(
    (scale: IScale) => onChange({ ...row, scale }),
    [row, onChange],
  );

  const handleChannelChange = useCallback(
    (index: number, ch: Encoding) => {
      const next = [...row.channels];
      next[index] = ch;
      onChange({ ...row, channels: next });
    },
    [row, onChange],
  );

  const removeChannel = useCallback(
    (ch: Encoding) => {
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
    (ch: Encoding) => {
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

  const compat = compatibleChannels(row.scale, isRaster);
  const availableToAdd = compat.filter(ch => !row.channels.includes(ch));

  return (
    <div className="jp-gis-grammar-rule">
      {/* Desktop: 7-col grid; Mobile: stacked top-to-bottom via sections */}
      <div className="jp-gis-grammar-rule-grid">
        {/* --- Input section --- */}
        <div className="jp-gis-grammar-section jp-gis-grammar-input-section">
          <FieldSelector
            fieldCount={fieldCountForScale(row.scale.scheme)}
            fields={row.fields ?? []}
            availableFields={availableFields}
            onFieldChange={handleFieldChange}
            onAddField={addField}
          />
        </div>

        {/* Arrow: input → scale */}
        <span className="jp-gis-grammar-arrow jp-gis-grammar-arrow-input">
          →
        </span>

        {/* --- Scale section --- */}
        <div className="jp-gis-grammar-section jp-gis-grammar-scale-section">
          <NativeSelect
            value={row.scale.scheme}
            onChange={e =>
              handleSchemeChange(e.target.value as IScale['scheme'])
            }
          >
            {SCHEME_OPTIONS.filter(({ disabled }) => !disabled).map(
              ({ value, label }) => (
                <NativeSelectOption key={value} value={value}>
                  {label}
                </NativeSelectOption>
              ),
            )}
          </NativeSelect>
          <button
            type="button"
            className="jp-gis-grammar-preview-btn"
            onClick={() => setExpanded(v => !v)}
            title={expanded ? 'Collapse editor' : 'Edit scale'}
          >
            <ScalePreview scale={row.scale} />
            <span className="jp-gis-grammar-preview-chevron" aria-hidden="true">
              {expanded ? '▾' : '▸'}
            </span>
          </button>
        </div>

        {/* Arrow: scale → output */}
        <span className="jp-gis-grammar-arrow jp-gis-grammar-arrow-output">
          →
        </span>

        {/* --- Output section --- */}
        <div className="jp-gis-grammar-section jp-gis-grammar-output-section">
          {row.channels.map((ch, i) => (
            <div key={`${ch}-${i}`} className="jp-gis-grammar-channel-row">
              <div className="jp-gis-grammar-channel-select">
                <NativeSelect
                  value={ch}
                  onChange={e =>
                    handleChannelChange(i, e.target.value as Encoding)
                  }
                >
                  {compat.map(c => (
                    <NativeSelectOption key={c} value={c}>
                      {CHANNEL_LABELS[c] ?? c}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-md"
                className="jp-mod-styled"
                onClick={() => removeChannel(ch)}
                title={
                  row.channels.length === 1
                    ? 'Remove mapping'
                    : 'Remove channel'
                }
              >
                <FontAwesomeIcon icon={faTrash} />
              </Button>
            </div>
          ))}

          {/* Add channel row */}
          {availableToAdd.length > 0 && (
            <div className="jp-gis-grammar-channel-row">
              <div className="jp-gis-grammar-channel-select">
                <NativeSelect
                  value=""
                  onChange={e => {
                    if (e.target.value) {
                      addChannel(e.target.value as Encoding);
                    }
                  }}
                >
                  <NativeSelectOption value="">
                    (add channel)
                  </NativeSelectOption>
                  {availableToAdd.map(ch => (
                    <NativeSelectOption key={ch} value={ch}>
                      {CHANNEL_LABELS[ch] ?? ch}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* When clause */}
      <div className="jp-gis-grammar-when-row">
        <span className="jp-gis-grammar-when-label">when</span>
        {(row.when?.length ?? 0) > 1 && (
          <Button
            type="button"
            className="jp-gis-grammar-when-op"
            onClick={() =>
              onChange({
                ...row,
                whenOp: (row.whenOp ?? 'all') === 'all' ? 'any' : 'all',
              })
            }
          >
            {row.whenOp ?? 'all'}
          </Button>
        )}
        {row.when?.map((pred, i) => (
          <span key={i} className="jp-gis-grammar-when-chip">
            {formatPredicate(pred)}
            <Button
              type="button"
              onClick={() => removePredicate(i)}
              title="Remove condition"
            >
              <FontAwesomeIcon icon={faXmark} />
            </Button>
          </span>
        ))}
        {addingWhen ? (
          <WhenAddForm
            availableFields={availableFields}
            onAdd={addPredicate}
            onCancel={() => setAddingWhen(false)}
          />
        ) : (
          <Button
            type="button"
            className="jp-gis-grammar-when-add-btn"
            onClick={() => setAddingWhen(true)}
          >
            <FontAwesomeIcon icon={faPlus} />
          </Button>
        )}
      </div>

      {/* Inline scale editor */}
      {expanded && (
        <div className="jp-gis-grammar-rule-editor">
          {(row.scale.scheme === 'constant_rgba' ||
            row.scale.scheme === 'constant_num') && (
            <ConstantEditor scale={row.scale} onChange={handleScaleChange} />
          )}
          {row.scale.scheme === 'colorRamp' && (
            <ColorRampEditor
              scale={row.scale}
              field={row.fields?.[0]}
              featureValues={featureValues}
              onChange={handleScaleChange}
            />
          )}
          {row.scale.scheme === 'categorical' && (
            <CategoricalEditor
              scale={row.scale}
              field={row.fields?.[0]}
              featureValues={featureValues}
              onChange={handleScaleChange}
            />
          )}
          {row.scale.scheme === 'scalar' && (
            <ScalarEditor
              scale={row.scale}
              field={row.fields?.[0]}
              featureValues={featureValues}
              onChange={handleScaleChange}
            />
          )}
          {row.scale.scheme === 'identity' && (
            <p
              style={{
                margin: 0,
                color: 'var(--jp-ui-font-color2)',
                fontSize: 'var(--jp-ui-font-size1)',
              }}
            >
              No configuration for identity scale.
            </p>
          )}
          {row.scale.scheme === 'expression' && (
            <ExpressionEditor scale={row.scale} onChange={handleScaleChange} />
          )}
        </div>
      )}
    </div>
  );
};

export default MappingRow;
