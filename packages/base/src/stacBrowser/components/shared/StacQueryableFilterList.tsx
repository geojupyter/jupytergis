import React, { useState } from 'react';

import { RadioGroup, RadioGroupItem } from '@/src/shared/components/RadioGroup';
import { QueryableCombo } from '../QueryableCombo';

interface IStacQueryableFilterListProps {
  queryableProps: [string, any][];
}

type FilterOperator = 'and' | 'or';



const StacQueryableFilterList: React.FC<IStacQueryableFilterListProps> = ({
  queryableProps,
}) => {
  const [filterOperator, setFilterOperator] = useState<FilterOperator>('and');

  return (
    <div>
      <div>
        <span>Additional Filters</span>
      </div>
      <div>
        <span>Match all filters (and) Match any filters (or)</span>
        <RadioGroup
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
      <div>
        <QueryableCombo queryables={queryableProps} />
      </div>
    </div>
  );
};

export default StacQueryableFilterList;
