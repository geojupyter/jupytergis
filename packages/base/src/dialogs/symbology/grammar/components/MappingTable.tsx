import React from 'react';

import {
  ALL_CHANNELS,
  CATEGORICAL_PALETTE,
  CHANNEL_LABELS,
  computeDomain,
  createDefaultRule,
  defaultColorRampScale,
  defaultScale,
} from '@/src/dialogs/symbology/grammar/grammarUtils';
import {
  IEncodingRule,
  IPredicate,
  IScale,
  OLStyleChannel,
} from '@/src/dialogs/symbology/grammar/types';
import MappingEditor from './MappingEditor';

// ---------------------------------------------------------------------------
// Scale schemes
// ---------------------------------------------------------------------------

const SCALE_SCHEMES: IScale['scheme'][] = [
  'colorRamp',
  'categorical',
  'scalar',
  'constant',
  'identity',
];

// ---------------------------------------------------------------------------
// Predicate chip — displays one `when` condition with a remove button
// ---------------------------------------------------------------------------

interface IPredicateChipProps {
  predicate: IPredicate;
  onRemove: () => void;
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
    onChange({ ...rule, field, scale: defaultScale(field, featureProperties) });
  };

  const handleChannelChange = (channel: OLStyleChannel) => {
    onChange({ ...rule, channel });
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
          fallback: 0,
        };
        break;
      case 'constant':
        scale = { scheme: 'constant', value: '#888888' };
        break;
      case 'identity':
      default:
        scale = { scheme: 'identity' };
    }
    onChange({ ...rule, scale });
  };

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
        {/* Subject: input field (hidden for constant — no field needed) */}
        {!isConstant && (
          <div className="jp-select-wrapper">
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
        )}

        {/* Verb: scheme selector */}
        <div className="jp-gis-mapping-verb">
          {!isConstant && <span className="jp-gis-mapping-arrow">──[</span>}
          <div className="jp-select-wrapper">
            <select
              className="jp-mod-styled"
              value={rule.scale.scheme}
              onClick={e => e.stopPropagation()}
              onChange={e => handleSchemeChange(e.target.value as IScale['scheme'])}
            >
              {SCALE_SCHEMES.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <span className="jp-gis-mapping-arrow">]──▶</span>
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

      {/* When-conditions row */}
      <div className="jp-gis-when-row" onClick={e => e.stopPropagation()}>
        {(rule.when ?? []).map((pred, i) => (
          <PredicateChip
            key={i}
            predicate={pred}
            onRemove={() => handleRemovePredicate(i)}
          />
        ))}
        {!showAddPredicate && (
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
        {showAddPredicate && (
          <AddPredicateForm
            fields={fields}
            onAdd={handleAddPredicate}
            onCancel={() => setShowAddPredicate(false)}
          />
        )}
      </div>

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
