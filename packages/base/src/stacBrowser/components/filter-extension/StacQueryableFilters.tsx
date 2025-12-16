import React from 'react';

import { RadioGroup, RadioGroupItem } from '@/src/shared/components/RadioGroup';
import { QueryableComboBox } from '@/src/stacBrowser/components/filter-extension/QueryableComboBox';
import {
  FilterOperator,
  IQueryableFilter,
  IStacQueryables,
  UpdateSelectedQueryables,
} from '@/src/stacBrowser/types/types';

interface IStacQueryableFilterListProps {
  queryableFields: IStacQueryables;
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
    <div className="jgis-stac-queryable-filters">
        <RadioGroup
          className="jgis-stac-queryable-filters-radio-group"
          value={filterOperator}
          onValueChange={(value: string) => {
            if (value === 'and' || value === 'or') {
              setFilterOperator(value);
            }
          }}
        >
          <div className="jgis-stac-queryable-filters-radio-item">
            <RadioGroupItem value="and" id="filter-operator-and" />
            <label htmlFor="filter-operator-and">Match all filters (and)</label>
          </div>
          <div className="jgis-stac-queryable-filters-radio-item">
            <RadioGroupItem value="or" id="filter-operator-or" />
            <label htmlFor="filter-operator-or">Match any filters (or)</label>
          </div>
        </RadioGroup>
      <QueryableComboBox
        queryables={queryableFields}
        selectedQueryables={selectedQueryables}
        updateSelectedQueryables={updateSelectedQueryables}
      />
    </div>
  );
};

export default StacQueryableFilters;
