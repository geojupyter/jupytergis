import { IJupyterGISModel } from '@jupytergis/schema';
import React, { useState } from 'react';

import { Combobox } from '@/src/shared/components/Combobox';
import { CommandItem } from '@/src/shared/components/Command';
import { Input } from '@/src/shared/components/Input';
import StacQueryableFilters from '@/src/stacBrowser/components/filter-extension/StacQueryableFilters';
import StacSpatialExtent from '@/src/stacBrowser/components/shared/StacSpatialExtent';
import StacTemporalExtent from '@/src/stacBrowser/components/shared/StacTemporalExtent';
import { useStacResultsContext } from '@/src/stacBrowser/context/StacResultsContext';
import { useStacFilterExtension } from '@/src/stacBrowser/hooks/useStacFilterExtension';
import { IStacCollection } from '@/src/stacBrowser/types/types';

interface IStacFilterExtensionPanelProps {
  model?: IJupyterGISModel;
}

type FilteredCollection = Pick<IStacCollection, 'id' | 'title'>;

function StacFilterExtensionPanel({ model }: IStacFilterExtensionPanelProps) {
  const { selectedUrl } = useStacResultsContext();
  const [limit, setLimit] = useState<number>(12);
  const [collectionComboboxOpen, setCollectionComboboxOpen] = useState(false);

  const {
    queryableFields,
    collections,
    selectedCollection,
    setSelectedCollection,
    startTime,
    endTime,
    setStartTime,
    setEndTime,
    useWorldBBox,
    setUseWorldBBox,
    selectedQueryables,
    updateSelectedQueryables,
    filterOperator,
    setFilterOperator,
  } = useStacFilterExtension({
    model,
    baseUrl: selectedUrl,
    limit,
  });

  if (!model) {
    console.warn('JupyterGIS model not found');
    return;
  }

  return (
    <>
      {/* temporal extent  */}
      <div className="jgis-stac-filter-extension-section">
        <StacTemporalExtent
          startTime={startTime}
          endTime={endTime}
          setStartTime={setStartTime}
          setEndTime={setEndTime}
        />
      </div>

      {/* spatial extent  */}
      <div className="jgis-stac-filter-extension-section">
        <StacSpatialExtent
          checked={useWorldBBox}
          onCheckedChange={setUseWorldBBox}
          label="Use entire world"
        />
      </div>

      {/* collections */}
      <div className="jgis-stac-filter-extension-section">
        <label className="jgis-stac-filter-extension-label">Collection</label>
        <Combobox
          showSearch={false}
          buttonText={
            selectedCollection
              ? collections.find(c => c.id === selectedCollection)?.title ||
                'Select a collection...'
              : 'Select a collection...'
          }
          emptyText="No collection found."
          buttonClassName="jgis-stac-filter-extension-select"
          open={collectionComboboxOpen}
          onOpenChange={setCollectionComboboxOpen}
        >
          {collections.map((option: FilteredCollection) => (
            <CommandItem
              key={option.id}
              value={option.title}
              onSelect={() => {
                setSelectedCollection(option.id);
                setCollectionComboboxOpen(false);
              }}
            >
              {option.title}
            </CommandItem>
          ))}
        </Combobox>
      </div>

      {/* Queryable filters */}
      {queryableFields && (
        <div className="jgis-stac-filter-extension-section">
          <label className="jgis-stac-filter-extension-label">
            Additional Filters
          </label>
          <StacQueryableFilters
            queryableFields={queryableFields}
            selectedQueryables={selectedQueryables}
            updateSelectedQueryables={updateSelectedQueryables}
            filterOperator={filterOperator}
            setFilterOperator={setFilterOperator}
          />
        </div>
      )}
      {/* sort */}

      {/* items per page */}
      <div className="jgis-stac-filter-extension-section">
        <label className="jgis-stac-filter-extension-label">
          Items per page
        </label>
        <Input
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
          className="jgis-stac-filter-extension-input"
        />
      </div>
    </>
  );
}

export default StacFilterExtensionPanel;
