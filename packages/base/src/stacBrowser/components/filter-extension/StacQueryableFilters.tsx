import React from 'react';

import { RadioGroup, RadioGroupItem } from '@/src/shared/components/RadioGroup';
import { QueryableComboBox } from '@/src/stacBrowser/components/filter-extension/QueryableComboBox';
import {
  FilterOperator,
  IQueryableFilter,
  UpdateSelectedQueryables,
} from '@/src/stacBrowser/hooks/useStacFilterExtension';

interface IStacQueryableFilterListProps {
  queryableFields: [string, any][];
  selectedQueryables: Record<string, IQueryableFilter>;
  updateSelectedQueryables: UpdateSelectedQueryables;
  filterOperator: FilterOperator;
  setFilterOperator: (operator: FilterOperator) => void;
}

const StacQueryableFilters: React.FC<IStacQueryableFilterListProps> = ({
  queryableFields,
  selectedQueryables,
  updateSelectedQueryables,
  filterOperator,
  setFilterOperator,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <div>
        <RadioGroup
          style={{ display: 'flex', gap: '0.5rem' }}
          value={filterOperator}
          onValueChange={(value: string) => {
            if (value === 'and' || value === 'or') {
              setFilterOperator(value);
            }
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <RadioGroupItem value="and" id="filter-operator-and" />
            <label htmlFor="filter-operator-and">Match all filters (and)</label>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <RadioGroupItem value="or" id="filter-operator-or" />
            <label htmlFor="filter-operator-or">Match any filters (or)</label>
          </div>
        </RadioGroup>
      </div>
      <QueryableComboBox
        queryables={queryableFields}
        selectedQueryables={selectedQueryables}
        updateSelectedQueryables={updateSelectedQueryables}
      />
    </div>
  );
};

export default StacQueryableFilters;
