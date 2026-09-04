import { Encoding, IScale } from '@jupytergis/schema';
import React from 'react';

import InlineConstant, {
  dataDrivenSchemeFor,
  isConstantScale,
} from '@/src/features/layers/symbology/components/InlineConstant';
import MappingRow, {
  ENCODING_LABELS,
  IGrammarRow,
  defaultScaleForScheme,
} from '@/src/features/layers/symbology/components/MappingRow';
import {
  numericValuesFor,
  withDataDomain,
} from '@/src/features/layers/symbology/scaleDomain';

interface IFieldOption {
  value: string;
  label: string;
}

interface IRuleGroupProps {
  rows: { row: IGrammarRow; index: number }[];
  availableFields: IFieldOption[];
  featureValues: Record<string, Set<any>>;
  isRaster?: boolean;
  disabledSchemes?: IScale['scheme'][];
  bandStats?: Record<number, { min: number; max: number }>;
  normalize?: boolean;
  onChangeRow: (index: number, row: IGrammarRow) => void;
  onDeleteRow: (index: number) => void;
}

/**
 * Drop the "label " that reads as noise once the controls sit on the label's
 * own row.
 */
function controlLabel(encodings: Encoding[]): string {
  const name = ENCODING_LABELS[encodings[0]] ?? encodings[0];
  return name.replace(/^label /, '');
}

/**
 * One rule, however many mappings it has.
 *
 * The channels that only carry a fixed value become controls on the leading
 * row, so a default label reads as one entry. A channel driven by data keeps
 * the full row it needs for its field, scale and stops, and appears beneath.
 */
const RuleGroup: React.FC<IRuleGroupProps> = ({
  rows,
  onChangeRow,
  onDeleteRow,
  ...rowProps
}) => {
  const renderRow = ({ row, index }: { row: IGrammarRow; index: number }) => (
    <MappingRow
      key={row.id}
      row={row}
      {...rowProps}
      onChange={updated => onChangeRow(index, updated)}
      onDelete={() => onDeleteRow(index)}
    />
  );

  if (rows.length === 1) {
    return renderRow(rows[0]);
  }

  const [head, ...rest] = rows;
  const constants = rest.filter(({ row }) => isConstantScale(row.scale));
  const dynamic = rest.filter(({ row }) => !isConstantScale(row.scale));

  /**
   * Give a fixed channel a scale and a field so it becomes a row of its own.
   * The rule's own field is the sensible starting point, and the row collapses
   * back into a control the moment its scheme returns to a constant.
   */
  const promote = ({ row, index }: { row: IGrammarRow; index: number }) => {
    const scheme = dataDrivenSchemeFor(row.scale);
    if (!scheme) {
      return;
    }
    const fields = row.fields ?? head.row.fields;
    onChangeRow(index, {
      ...row,
      fields,
      scale: withDataDomain(
        defaultScaleForScheme(scheme, row.encodings),
        numericValuesFor(fields?.[0], rowProps.featureValues),
      ),
    });
  };

  return (
    <div className="jp-gis-grammar-rule-group">
      {renderRow(head)}
      {constants.length > 0 && (
        <div className="jp-gis-grammar-rule-constants">
          {constants.map(({ row, index }) => (
            <label key={row.id} className="jp-gis-grammar-rule-constant">
              <span>{controlLabel(row.encodings)}</span>
              <InlineConstant
                scale={row.scale}
                encodings={row.encodings}
                onChange={scale => onChangeRow(index, { ...row, scale })}
                onPromote={() => promote({ row, index })}
              />
            </label>
          ))}
        </div>
      )}
      {dynamic.map(renderRow)}
    </div>
  );
};

export default RuleGroup;
