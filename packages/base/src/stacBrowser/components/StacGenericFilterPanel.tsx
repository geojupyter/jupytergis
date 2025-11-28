import { IJupyterGISModel } from '@jupytergis/schema';
import React from 'react';

import StacCheckboxWithLabel from './shared/StacCheckboxWithLabel';
import StacQueryableFilterList from './shared/StacQueryableFilterList';
import StacSearchDatePicker from './shared/StacSearchDatePicker';
import { useStacGenericFilter } from '../hooks/useStacGenericFilter';
import useStacSearch from '../hooks/useStacSearch';
import { IStacCollection } from '../types/types';

interface IStacBrowser2Props {
  model?: IJupyterGISModel;
}

type FilteredCollection = Pick<IStacCollection, 'id' | 'title'>;

const API_URL = 'https://stac.dataspace.copernicus.eu/v1/';

// This is a generic UI for apis that support filter extension
function StacGenericFilterPanel({ model }: IStacBrowser2Props) {
  const {
    startTime,
    endTime,
    setStartTime,
    setEndTime,
    useWorldBBox,
    setUseWorldBBox,
  } = useStacSearch({
    model,
  });

  const {
    queryableProps,
    collections,
    selectedCollection,
    setSelectedCollection,
    handleSubmit,
  } = useStacGenericFilter({
    model,
    startTime,
    endTime,
    useWorldBBox,
  });

  if (!model) {
    console.log('no model');
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
      {/* fake api choice */}
      <div
        style={{
          paddingBottom: '0.5rem',
          borderBottom: '1px solid var(--jp-border-color0)',
        }}
      >
        <span
          style={{ fontSize: '0.875rem', color: 'var(--jp-ui-font-color2)' }}
        >
          API: {API_URL}
        </span>
      </div>
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
      {/* items IDs */}
      {/* additional filters - this is where queryables should end up */}
      {queryableProps && (
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
        >
          <StacQueryableFilterList queryableProps={queryableProps} />
        </div>
      )}
      {/* sort */}
      {/* items per page */}
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
