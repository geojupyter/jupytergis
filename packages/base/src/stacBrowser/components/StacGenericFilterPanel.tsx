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
    <div
      style={{
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      {/* temporal extent  */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <StacSearchDatePicker
          startTime={startTime}
          endTime={endTime}
          setStartTime={setStartTime}
          setEndTime={setEndTime}
        />
      </div>

      {/* spatial extent  */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <StacCheckboxWithLabel
          checked={useWorldBBox}
          onCheckedChange={setUseWorldBBox}
          label="Use entire world"
        />
      </div>

      {/* collections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>
          Collection
        </label>
        <select
          style={{
            maxWidth: '200px',
            padding: '0.5rem',
            borderRadius: '0.25rem',
            border: '1px solid var(--jp-border-color0)',
          }}
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
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
        >
          <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>
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
          style={{
            maxWidth: '200px',
            padding: '0.5rem',
            borderRadius: '0.25rem',
            border: '1px solid var(--jp-border-color0)',
          }}
        />
      </div>

      {/* buttons */}
      <div
        style={{
          paddingTop: '0.5rem',
          borderTop: '1px solid var(--jp-border-color0)',
        }}
      >
        <button
          onClick={handleSubmit}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.25rem',
            border: '1px solid var(--jp-border-color0)',
            backgroundColor: 'var(--jp-layout-color0)',
            color: 'var(--jp-ui-font-color0)',
            cursor: 'pointer',
          }}
        >
          Submit
        </button>
      </div>
    </div>
  );
}

export default StacGenericFilterPanel;
