import React from 'react';

import { RadioGroup, RadioGroupItem } from '@/src/shared/components/RadioGroup';
import { QueryableComboBox } from './QueryableComboBox';
import {
  FilterOperator,
  UpdateSelectedQueryables,
} from '../../hooks/useStacFilterExtension';

interface IStacQueryableFilterListProps {
  queryableFields: [string, any][];
  updateSelectedQueryables: UpdateSelectedQueryables;
  filterOperator: FilterOperator;
  setFilterOperator: (operator: FilterOperator) => void;
}

const StacQueryableFilters: React.FC<IStacQueryableFilterListProps> = ({
  queryableFields,
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
        updateSelectedQueryables={updateSelectedQueryables}
      />
    </div>
  );
};

export default StacQueryableFilters;
