import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Encoding, IScale } from '@jupytergis/schema';
import React from 'react';

import InlineConstant, {
  dataDrivenSchemeFor,
  isConstantScale,
} from '@/src/features/layers/symbology/components/InlineConstant';
import MappingRow, {
  ENCODING_LABELS,
  IGrammarRow,
  SHADOWED_HINT,
  defaultScaleForScheme,
} from '@/src/features/layers/symbology/components/MappingRow';
import {
  numericValuesFor,
  withDataDomain,
} from '@/src/features/layers/symbology/scaleDomain';
import { Button } from '@/src/shared/components/Button';

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
  zoomRangeSupported?: boolean;
  whenDisabled?: boolean;
  shadowedEncodings: Map<string, Set<Encoding>>;
  onChangeRow: (index: number, row: IGrammarRow) => void;
  onDeleteRows: (indices: number[]) => void;
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
 *
 * Because those controls are part of the leading row, deleting that row takes
 * them with it. Leaving them behind would promote one of them to the leading
 * row and strand the rest, which mean nothing without the channel they style.
 * A label's data-driven rows go too, since they style nothing without its text.
 */
const RuleGroup: React.FC<IRuleGroupProps> = ({
  rows,
  shadowedEncodings,
  onChangeRow,
  onDeleteRows,
  ...rowProps
}) => {
  const renderRow = (
    { row, index }: { row: IGrammarRow; index: number },
    hideWhen = false,
    alsoDelete: number[] = [],
  ) => (
    <MappingRow
      key={row.id}
      row={row}
      {...rowProps}
      hideWhen={hideWhen}
      shadowed={shadowedEncodings.get(row.id)}
      onChange={updated => onChangeRow(index, updated)}
      onDelete={() => onDeleteRows([index, ...alsoDelete])}
    />
  );

  if (rows.length === 1) {
    return renderRow(rows[0]);
  }

  const [head, ...rest] = rows;
  const constants = rest.filter(({ row }) => isConstantScale(row.scale));
  const dynamic = rest.filter(({ row }) => !isConstantScale(row.scale));

  const { featureValues } = rowProps;
  const hasNumbers = (field: string) =>
    numericValuesFor(field, featureValues).length > 0;

  /**
   * The input a fixed channel starts from once it follows the data. The rule's
   * own field is the sensible default, except that a ramp cannot read a text
   * column, so it takes the first numeric one. Undefined when there is none.
   */
  const promotedFields = (row: IGrammarRow): string[] | undefined => {
    const own = row.fields ?? head.row.fields ?? [];
    const readsNumbers = dataDrivenSchemeFor(row.scale) !== 'identity';
    if (!readsNumbers || !(own[0] in featureValues) || hasNumbers(own[0])) {
      return own;
    }
    const numeric = Object.keys(featureValues).find(hasNumbers);
    return numeric ? [numeric] : undefined;
  };

  /**
   * Give a fixed channel a scale and a field so it becomes a row of its own.
   * The row collapses back into a control the moment its scheme returns to a
   * constant.
   */
  const promote = ({ row, index }: { row: IGrammarRow; index: number }) => {
    const scheme = dataDrivenSchemeFor(row.scale);
    if (!scheme) {
      return;
    }
    const fields = promotedFields(row);
    onChangeRow(index, {
      ...row,
      fields,
      scale: withDataDomain(
        defaultScaleForScheme(scheme, row.encodings),
        numericValuesFor(fields?.[0], featureValues),
      ),
    });
  };

  return (
    <div className="jp-gis-grammar-rule-group">
      {renderRow(
        head,
        false,
        (head.row.encodings.includes('text-value') ? rest : constants).map(
          ({ index }) => index,
        ),
      )}
      {constants.length > 0 && (
        <div className="jp-gis-grammar-rule-constants">
          {constants.map(({ row, index }) => (
            <label
              key={row.id}
              className={
                shadowedEncodings.has(row.id)
                  ? 'jp-gis-grammar-rule-constant jp-mod-shadowed'
                  : 'jp-gis-grammar-rule-constant'
              }
              title={shadowedEncodings.has(row.id) ? SHADOWED_HINT : undefined}
            >
              <span>{controlLabel(row.encodings)}</span>
              <InlineConstant
                scale={row.scale}
                encodings={row.encodings}
                disabled={shadowedEncodings.has(row.id)}
                onChange={scale => onChangeRow(index, { ...row, scale })}
                onPromote={
                  promotedFields(row) && (() => promote({ row, index }))
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => onDeleteRows([index])}
                title="Remove mapping"
              >
                <FontAwesomeIcon icon={faTrash} />
              </Button>
            </label>
          ))}
        </div>
      )}
      {dynamic.map(entry => renderRow(entry, true))}
    </div>
  );
};

export default RuleGroup;
