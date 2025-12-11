import { IJupyterGISModel } from '@jupytergis/schema';
import React, { useState } from 'react';

import { useStacResultsContext } from '../context/StacResultsContext';
import StacCheckboxWithLabel from './shared/StacCheckboxWithLabel';
import StacQueryableFilters from './shared/StacQueryableFilters';
import StacSearchDatePicker from './shared/StacSearchDatePicker';
import { useStacGenericFilter } from '../hooks/useStacGenericFilter';
import { IStacCollection } from '../types/types';

interface IStacBrowser2Props {
  model?: IJupyterGISModel;
}

type FilteredCollection = Pick<IStacCollection, 'id' | 'title'>;

// This is a generic UI for apis that support filter extension
function StacGenericFilterPanel({ model }: IStacBrowser2Props) {
  const { setResults, setPaginationLinks, selectedUrl } =
    useStacResultsContext();
  const [limit, setLimit] = useState<number>(12);

  const {
    queryableProps,
    collections,
    selectedCollection,
    setSelectedCollection,
    handleSubmit,
    startTime,
    endTime,
    setStartTime,
    setEndTime,
    useWorldBBox,
    setUseWorldBBox,
    updateQueryableFilter,
    filterOperator,
    setFilterOperator,
  } = useStacGenericFilter({
    model,
    baseUrl: selectedUrl,
    limit,
    setResults,
    setPaginationLinks,
  });

  if (!model) {
    console.warn('JupyterGIS model not found');
    return;
  }

  return (
    <div className="jgis-stac-generic-filter-panel">
      {/* temporal extent  */}
      <div className="jgis-stac-generic-filter-section">
        <StacSearchDatePicker
          startTime={startTime}
          endTime={endTime}
          setStartTime={setStartTime}
          setEndTime={setEndTime}
        />
      </div>

      {/* spatial extent  */}
      <div className="jgis-stac-generic-filter-section">
        <StacCheckboxWithLabel
          checked={useWorldBBox}
          onCheckedChange={setUseWorldBBox}
          label="Use entire world"
        />
      </div>

      {/* collections */}
      <div className="jgis-stac-generic-filter-section">
        <label className="jgis-stac-generic-filter-label">
          Collection
        </label>
        <select
          className="jgis-stac-generic-filter-select"
          value={selectedCollection}
          onChange={e => setSelectedCollection(e.target.value)}
        >
          {collections.map((option: FilteredCollection) => (
            <option key={option.id} value={option.id}>
              {option.title}
            </option>
          ))}
        </select>
      </div>

      {/* Queryable filters */}
      {queryableProps && (
        <div className="jgis-stac-generic-filter-section">
          <label className="jgis-stac-generic-filter-label">
            Additional Filters
          </label>
          <StacQueryableFilters
            queryableProps={queryableProps}
            updateQueryableFilter={updateQueryableFilter}
            filterOperator={filterOperator}
            setFilterOperator={setFilterOperator}
          />
        </div>
      )}
      {/* sort */}

      {/* ! do i really want this? */}
      {/* items per page */}
      <div className="jgis-stac-generic-filter-section">
        <label className="jgis-stac-generic-filter-label">
          Items per page
        </label>
        <input
          type="number"
          min="1"
          max="1000"
          value={limit}
          onChange={e => {
            const value = parseInt(e.target.value, 10);
            if (!isNaN(value) && value > 0) {
              setLimit(value);
            }
          }}
          className="jgis-stac-generic-filter-input"
        />
      </div>

      {/* buttons */}
      <div className="jgis-stac-generic-filter-button-container">
        <button
          onClick={handleSubmit}
          className="jgis-stac-generic-filter-button"
        >
          Submit
        </button>
      </div>
    </div>
  );
}

export default StacGenericFilterPanel;
