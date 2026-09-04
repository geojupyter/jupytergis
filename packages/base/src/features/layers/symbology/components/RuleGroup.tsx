import {
  faChevronDown,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Encoding, IScale } from '@jupytergis/schema';
import React, { useState } from 'react';

import MappingRow, {
  ENCODING_LABELS,
  IGrammarRow,
} from '@/src/features/layers/symbology/components/MappingRow';
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
  onChangeRow: (index: number, row: IGrammarRow) => void;
  onDeleteRow: (index: number) => void;
}

/** Name the extra channels so the summary says what is hidden. */
function channelSummary(rows: { row: IGrammarRow }[]): string {
  return rows
    .flatMap(({ row }) => row.encodings as Encoding[])
    .map(encoding => ENCODING_LABELS[encoding] ?? encoding)
    .join(', ');
}

/**
 * One rule, however many mappings it has.
 *
 * A single-mapping rule renders as the bare row it always did. A rule with
 * several mappings leads with the first and keeps the rest collapsed, so a
 * label reads as one entry in the list rather than four.
 */
const RuleGroup: React.FC<IRuleGroupProps> = ({
  rows,
  onChangeRow,
  onDeleteRow,
  ...rowProps
}) => {
  const [expanded, setExpanded] = useState(false);

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

  return (
    <div className="jp-gis-grammar-rule-group">
      {renderRow(head)}
      <Button
        type="button"
        variant="ghost"
        className="jp-gis-grammar-rule-group-toggle"
        onClick={() => setExpanded(!expanded)}
        title={channelSummary(rest)}
      >
        <FontAwesomeIcon
          data-icon="inline-start"
          icon={expanded ? faChevronDown : faChevronRight}
        />
        {expanded ? 'Hide styling' : `Styling (${channelSummary(rest)})`}
      </Button>
      {expanded && rest.map(renderRow)}
    </div>
  );
};

export default RuleGroup;
