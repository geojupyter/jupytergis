import React from 'react';

import {
  ALL_CHANNELS,
  CATEGORICAL_PALETTE,
  CHANNEL_LABELS,
  channelType,
  computeDomain,
  createDefaultRule,
  defaultColorRampScale,
  defaultScaleForChannel,
  isSchemeCompatible,
  scaleOutputType,
} from '@/src/dialogs/symbology/grammar/grammarUtils';
import {
  IEncodingRule,
  IPredicate,
  IScale,
  OLStyleChannel,
} from '@/src/dialogs/symbology/grammar/types';
import { Utils } from '@/src/dialogs/symbology/symbologyUtils';
import MappingEditor from './MappingEditor';

// ---------------------------------------------------------------------------
// ScalePreview — compact inline indicator shown in the collapsed row
// ---------------------------------------------------------------------------

const MODE_ABBR: Record<string, string> = {
  'equal interval': 'EI',
  'quantile':       'Q',
  'jenks':          'J',
  'pretty':         'P',
  'logarithmic':    'log',
};

/** Format a number compactly for the preview label (≤ ~5 chars). */
function fmtNum(n: number): string {
  if (!isFinite(n)) {
    return '?';
  }
  return parseFloat(n.toPrecision(3)).toString();
}

/** Build a CSS linear-gradient string for a colorRamp scale. */
function buildRampGradientCss(
  scale: Extract<IScale, { scheme: 'colorRamp' }>,
): string {
  if (scale.colorStops && scale.colorStops.length >= 2) {
    const [dMin, dMax] = scale.domain;
    const range = dMax - dMin || 1;
    const stops = scale.colorStops.map(cs => {
      const pct = ((cs.stop - dMin) / range) * 100;
      const [r, g, b, a] = cs.color;
      return `rgba(${r},${g},${b},${a ?? 1}) ${pct.toFixed(1)}%`;
    });
    return `linear-gradient(to right, ${stops.join(', ')})`;
  }
  // No classified stops yet — generate from ramp name.
  try {
    const breaks = Array.from({ length: 9 }, (_, i) => i / 8);
    const pairs = Utils.getValueColorPairs(
      breaks,
      scale.name as any,
      9,
      scale.reverse,
    );
    const stops = pairs.map((p, i) => {
      const [r, g, b, a] = p.output as [number, number, number, number];
      return `rgba(${r},${g},${b},${a ?? 1}) ${((i / (pairs.length - 1)) * 100).toFixed(1)}%`;
    });
    return `linear-gradient(to right, ${stops.join(', ')})`;
  } catch {
    return 'linear-gradient(to right, #888, #888)';
  }
}

interface IScalePreviewProps {
  scale: IScale;
  channel: OLStyleChannel;
}

const ScalePreview: React.FC<IScalePreviewProps> = ({ scale, channel }) => {
  switch (scale.scheme) {
    case 'constant': {
      if (channelType(channel) === 'color') {
        const color =
          typeof scale.value === 'string'
            ? scale.value
            : Array.isArray(scale.value)
              ? `rgba(${(scale.value as number[]).join(',')})`
              : '#888';
        return (
          <span
            className="jp-gis-scale-preview-swatch"
            style={{ background: color }}
            title={color}
          />
        );
      }
      return (
        <span className="jp-gis-scale-preview-text" title={String(scale.value)}>
          {scale.value}
        </span>
      );
    }
    case 'colorRamp': {
      const gradient = buildRampGradientCss(scale);
      const abbr = MODE_ABBR[scale.mode] ?? scale.mode;
      return (
        <span
          className="jp-gis-scale-preview-ramp"
          title={`${scale.name} · ${scale.mode} · [${fmtNum(scale.domain[0])}–${fmtNum(scale.domain[1])}]`}
        >
          <span
            className="jp-gis-scale-preview-ramp-bar"
            style={{ background: gradient }}
          />
          <span className="jp-gis-scale-preview-ramp-label">
            {fmtNum(scale.domain[0])}–{fmtNum(scale.domain[1])}{' '}
            <em>{abbr}</em>
          </span>
        </span>
      );
    }
    case 'categorical': {
      const colors = Object.values(scale.mapping).slice(0, 6);
      const nTotal = Object.keys(scale.mapping).length;
      return (
        <span
          className="jp-gis-scale-preview-categorical"
          title={`${nTotal} categories`}
        >
          {colors.map((c, i) => (
            <span
              key={i}
              className="jp-gis-scale-preview-swatch"
              style={{ background: c }}
            />
          ))}
          {nTotal > 6 && (
            <span className="jp-gis-scale-preview-more">+{nTotal - 6}</span>
          )}
        </span>
      );
    }
    case 'scalar': {
      const abbr = MODE_ABBR[scale.mode] ?? scale.mode;
      return (
        <span
          className="jp-gis-scale-preview-text jp-gis-scale-preview-scalar"
          title={`[${fmtNum(scale.domain[0])}–${fmtNum(scale.domain[1])}] → [${fmtNum(scale.range[0])}–${fmtNum(scale.range[1])}] (${scale.mode})`}
        >
          {fmtNum(scale.domain[0])}–{fmtNum(scale.domain[1])}
          <span className="jp-gis-scale-preview-arrow">→</span>
          {fmtNum(scale.range[0])}–{fmtNum(scale.range[1])}{' '}
          <em>{abbr}</em>
        </span>
      );
    }
    case 'identity':
    default:
      return null;
  }
};

// ---------------------------------------------------------------------------
// Scale schemes — ordered so color-output schemes come first
// ---------------------------------------------------------------------------

const ALL_SCHEMES: IScale['scheme'][] = [
  'colorRamp',
  'categorical',
  'scalar',
  'constant',
  'identity',
];

const SCHEME_LABELS: Record<IScale['scheme'], string> = {
  colorRamp:   'color ramp  (number → color)',
  categorical: 'categorical (value → color)',
  scalar:      'scalar      (number → number)',
  constant:    'constant    (fixed value)',
  identity:    'identity    (pass-through)',
};

// ---------------------------------------------------------------------------
// Predicate chip — displays one `when` condition with a remove button
// ---------------------------------------------------------------------------

interface IPredicateChipProps {
  predicate: IPredicate;
  onRemove?: () => void;
}

const PredicateChip: React.FC<IPredicateChipProps> = ({ predicate, onRemove }) => {
  let label: string;
  switch (predicate.type) {
    case 'geometryType':
      label = `geom = ${predicate.value}`;
      break;
    case 'hasField':
      label = `has ${predicate.field}`;
      break;
    case 'fieldEquals':
      label = `${predicate.field} = ${predicate.value}`;
      break;
  }
  return (
    <span className="jp-gis-predicate-chip">
      {label}
      {onRemove && (
        <button
          className="jp-gis-predicate-remove"
          title="Remove condition"
          onClick={e => {
            e.stopPropagation();
            onRemove();
          }}
        >
          ×
        </button>
      )}
    </span>
  );
};

// ---------------------------------------------------------------------------
// AddPredicatePopover — inline form for adding a new predicate
// ---------------------------------------------------------------------------

interface IAddPredicateProps {
  fields: string[];
  onAdd: (predicate: IPredicate) => void;
  onCancel: () => void;
}

const AddPredicateForm: React.FC<IAddPredicateProps> = ({ fields, onAdd, onCancel }) => {
  const [predicateType, setPredicateType] = React.useState<IPredicate['type']>('geometryType');
  const [geomValue, setGeomValue] = React.useState<'point' | 'line' | 'polygon'>('point');
  const [fieldName, setFieldName] = React.useState(fields[0] ?? '');
  const [fieldValue, setFieldValue] = React.useState('');

  const handleAdd = () => {
    let predicate: IPredicate;
    switch (predicateType) {
      case 'geometryType':
        predicate = { type: 'geometryType', value: geomValue };
        break;
      case 'hasField':
        predicate = { type: 'hasField', field: fieldName };
        break;
      case 'fieldEquals':
        predicate = { type: 'fieldEquals', field: fieldName, value: fieldValue };
        break;
    }
    onAdd(predicate);
  };

  return (
    <div className="jp-gis-predicate-form" onClick={e => e.stopPropagation()}>
      <div className="jp-select-wrapper">
        <select
          className="jp-mod-styled"
          value={predicateType}
          onChange={e => setPredicateType(e.target.value as IPredicate['type'])}
        >
          <option value="geometryType">geometry type</option>
          <option value="hasField">has field</option>
          <option value="fieldEquals">field equals</option>
        </select>
      </div>

      {predicateType === 'geometryType' && (
        <div className="jp-select-wrapper">
          <select
            className="jp-mod-styled"
            value={geomValue}
            onChange={e => setGeomValue(e.target.value as typeof geomValue)}
          >
            <option value="point">point</option>
            <option value="line">line</option>
            <option value="polygon">polygon</option>
          </select>
        </div>
      )}

      {(predicateType === 'hasField' || predicateType === 'fieldEquals') && (
        <div className="jp-select-wrapper">
          <select
            className="jp-mod-styled"
            value={fieldName}
            onChange={e => setFieldName(e.target.value)}
          >
            {fields.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
      )}

      {predicateType === 'fieldEquals' && (
        <input
          type="text"
          className="jp-mod-styled"
          placeholder="value"
          value={fieldValue}
          onChange={e => setFieldValue(e.target.value)}
          onClick={e => e.stopPropagation()}
        />
      )}

      <button
        className="jp-Dialog-button jp-mod-accept jp-mod-styled jp-gis-predicate-add-ok"
        onClick={handleAdd}
      >
        Add
      </button>
      <button
        className="jp-Dialog-button jp-mod-styled jp-gis-predicate-add-cancel"
        onClick={onCancel}
      >
        Cancel
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// MappingRow — one triple: field | [scheme ▾ + config] | channel, expandable
// ---------------------------------------------------------------------------

interface IMappingRowProps {
  rule: IEncodingRule;
  fields: string[];
  featureProperties: Record<string, Set<any>>;
  isExpanded: boolean;
  onToggle: () => void;
  onChange: (rule: IEncodingRule) => void;
  onDelete: () => void;
}

const MappingRow: React.FC<IMappingRowProps> = ({
  rule,
  fields,
  featureProperties,
  isExpanded,
  onToggle,
  onChange,
  onDelete,
}) => {
  const [showAddPredicate, setShowAddPredicate] = React.useState(false);
  const isConstant = rule.scale.scheme === 'constant';

  const handleFieldChange = (field: string) => {
    // Keep current scheme if compatible with current channel, else reset.
    const scale = isSchemeCompatible(rule.scale.scheme, rule.channel)
      ? rule.scale
      : defaultScaleForChannel(rule.channel, field, featureProperties);
    onChange({ ...rule, field, scale });
  };

  const handleChannelChange = (channel: OLStyleChannel) => {
    // If the current scheme is incompatible with the new channel, auto-switch
    // to the sensible default for that channel.
    if (!isSchemeCompatible(rule.scale.scheme, channel)) {
      onChange({
        ...rule,
        channel,
        scale: defaultScaleForChannel(channel, rule.field ?? '', featureProperties),
      });
    } else {
      onChange({ ...rule, channel });
    }
  };

  const handleSchemeChange = (scheme: IScale['scheme']) => {
    const values = featureProperties[rule.field ?? ''] ?? new Set();
    let scale: IScale;
    switch (scheme) {
      case 'colorRamp':
        scale = defaultColorRampScale(values);
        break;
      case 'categorical': {
        const mapping: Record<string, string> = {};
        Array.from(values)
          .slice(0, 20)
          .forEach((v, i) => {
            mapping[String(v)] =
              CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length];
          });
        scale = { scheme: 'categorical', mapping, fallback: 'rgba(0,0,0,0)' };
        break;
      }
      case 'scalar':
        scale = {
          scheme: 'scalar',
          domain: computeDomain(values),
          range: [0, 10],
          mode: 'equal interval',
          nStops: 9,
          fallback: 0,
        };
        break;
      case 'constant':
        // Default constant value depends on channel type.
        scale = {
          scheme: 'constant',
          value: channelType(rule.channel) === 'color' ? '#888888' : 1,
        };
        break;
      case 'identity':
      default:
        scale = { scheme: 'identity' };
    }
    onChange({ ...rule, scale });
  };

  const schemeCompatible = isSchemeCompatible(rule.scale.scheme, rule.channel);

  const handleAddPredicate = (predicate: IPredicate) => {
    const when = [...(rule.when ?? []), predicate];
    onChange({ ...rule, when });
    setShowAddPredicate(false);
  };

  const handleRemovePredicate = (index: number) => {
    const when = (rule.when ?? []).filter((_, i) => i !== index);
    onChange({ ...rule, when: when.length > 0 ? when : undefined });
  };

  return (
    <div className={`jp-gis-mapping-row-wrapper${isExpanded ? ' jp-gis-mapping-row-expanded' : ''}`}>
      {/* Triple header row */}
      <div
        className="jp-gis-mapping-row"
        onClick={onToggle}
      >
        {/* Subject: input field (invisible for constant, but keeps layout space) */}
        <div className="jp-select-wrapper" style={isConstant ? { visibility: 'hidden' } : undefined}>
          <select
            className="jp-mod-styled"
            value={rule.field ?? ''}
            onClick={e => e.stopPropagation()}
            onChange={e => handleFieldChange(e.target.value)}
          >
            {fields.map(f => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        {/* Verb: scheme selector */}
        <div className="jp-gis-mapping-verb">
          <span className="jp-gis-mapping-arrow" style={isConstant ? { visibility: 'hidden' } : undefined}>──[</span>
          <div className={`jp-select-wrapper${!schemeCompatible ? ' jp-gis-scheme-mismatch' : ''}`}>
            <select
              className="jp-mod-styled"
              value={rule.scale.scheme}
              title={!schemeCompatible ? `"${rule.scale.scheme}" outputs ${scaleOutputType(rule.scale.scheme)} but channel expects ${channelType(rule.channel)}` : undefined}
              onClick={e => e.stopPropagation()}
              onChange={e => handleSchemeChange(e.target.value as IScale['scheme'])}
            >
              {ALL_SCHEMES.map(s => {
                const compatible = isSchemeCompatible(s, rule.channel);
                return (
                  <option key={s} value={s} disabled={false}>
                    {compatible ? SCHEME_LABELS[s] : `⚠ ${SCHEME_LABELS[s]}`}
                  </option>
                );
              })}
            </select>
          </div>
          <span className="jp-gis-mapping-arrow">]──▶</span>
        </div>

        {/* Preview indicator */}
        <div className="jp-gis-scale-preview-container">
          <ScalePreview scale={rule.scale} channel={rule.channel} />
        </div>

        {/* Object: output channel */}
        <div className="jp-select-wrapper">
          <select
            className="jp-mod-styled"
            value={rule.channel}
            onClick={e => e.stopPropagation()}
            onChange={e => handleChannelChange(e.target.value as OLStyleChannel)}
          >
            {ALL_CHANNELS.map(c => (
              <option key={c} value={c}>
                {CHANNEL_LABELS[c]}
              </option>
            ))}
          </select>
        </div>

        <button
          className="jp-gis-mapping-delete"
          title="Remove mapping"
          onClick={e => {
            e.stopPropagation();
            onDelete();
          }}
        >
          ×
        </button>
      </div>

      {/* When-conditions row — hidden when empty and collapsed */}
      {((rule.when ?? []).length > 0 || isExpanded) && (
        <div className="jp-gis-when-row" onClick={e => e.stopPropagation()}>
          {(rule.when ?? []).map((pred, i) => (
            <PredicateChip
              key={i}
              predicate={pred}
              onRemove={isExpanded ? () => handleRemovePredicate(i) : undefined}
            />
          ))}
          {isExpanded && !showAddPredicate && (
            <button
              className="jp-gis-predicate-add-btn"
              title="Add condition"
              onClick={e => {
                e.stopPropagation();
                setShowAddPredicate(true);
              }}
            >
              + when
            </button>
          )}
          {isExpanded && showAddPredicate && (
            <AddPredicateForm
              fields={fields}
              onAdd={handleAddPredicate}
              onCancel={() => setShowAddPredicate(false)}
            />
          )}
        </div>
      )}

      {/* Inline method editor — expands below the row */}
      {isExpanded && (
        <div className="jp-gis-mapping-editor-inline">
          <MappingEditor
            rule={rule}
            featureProperties={featureProperties}
            onChange={onChange}
          />
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// MappingTable
// ---------------------------------------------------------------------------

interface IMappingTableProps {
  rules: IEncodingRule[];
  featureProperties: Record<string, Set<any>>;
  selectedRuleId: string | null;
  onSelectRule: (id: string) => void;
  onRulesChange: (rules: IEncodingRule[]) => void;
}

const MappingTable: React.FC<IMappingTableProps> = ({
  rules,
  featureProperties,
  selectedRuleId,
  onSelectRule,
  onRulesChange,
}) => {
  const fields = Object.keys(featureProperties);

  const handleAdd = () => {
    const newRule = createDefaultRule(featureProperties, rules);
    onRulesChange([...rules, newRule]);
    onSelectRule(newRule.id);
  };

  const handleChange = (updated: IEncodingRule) => {
    onRulesChange(rules.map(r => (r.id === updated.id ? updated : r)));
  };

  const handleDelete = (id: string) => {
    const updated = rules.filter(r => r.id !== id);
    onRulesChange(updated);
  };

  return (
    <div className="jp-gis-mapping-table">
      {rules.length === 0 && (
        <p className="jp-gis-mapping-empty">
          No mappings yet. Click &quot;+ Add Mapping&quot; to start.
        </p>
      )}
      {rules.map(rule => (
        <MappingRow
          key={rule.id}
          rule={rule}
          fields={fields}
          featureProperties={featureProperties}
          isExpanded={rule.id === selectedRuleId}
          onToggle={() =>
            onSelectRule(rule.id === selectedRuleId ? '' : rule.id)
          }
          onChange={handleChange}
          onDelete={() => handleDelete(rule.id)}
        />
      ))}
      <button
        className="jp-Dialog-button jp-mod-accept jp-mod-styled jp-gis-mapping-add"
        onClick={handleAdd}
        disabled={fields.length === 0}
      >
        + Add Mapping
      </button>
    </div>
  );
};

export default MappingTable;
