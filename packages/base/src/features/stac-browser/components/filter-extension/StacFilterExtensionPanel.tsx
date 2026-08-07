import { IJupyterGISModel } from '@jupytergis/schema';
import React, { useState } from 'react';

import StacQueryableFilters from '@/src/features/stac-browser/components/filter-extension/StacQueryableFilters';
import StacSpatialExtent from '@/src/features/stac-browser/components/shared/StacSpatialExtent';
import StacTemporalExtent from '@/src/features/stac-browser/components/shared/StacTemporalExtent';
import { useStacResultsContext } from '@/src/features/stac-browser/context/StacResultsContext';
import { useStacFilterExtension } from '@/src/features/stac-browser/hooks/useStacFilterExtension';
import { IStacCollection } from '@/src/features/stac-browser/types/types';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/src/shared/components/Combobox';
import { Input } from '@/src/shared/components/Input';

interface IStacFilterExtensionPanelProps {
  model?: IJupyterGISModel;
}

type CollectionItem = {
  value: string;
  label: string;
};

function StacFilterExtensionPanel({ model }: IStacFilterExtensionPanelProps) {
  const { selectedUrl } = useStacResultsContext();
  const [limit, setLimit] = useState<number>(12);

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

  const collectionItems: CollectionItem[] = collections.map(
    (option: Pick<IStacCollection, 'id' | 'title'>) => ({
      value: option.id,
      label: option.title || option.id,
    }),
  );

  const selectedItem =
    collectionItems.find(item => item.value === selectedCollection) ?? null;

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
          items={collectionItems}
          itemToStringValue={(item: CollectionItem) => item.label}
          value={selectedItem}
          onValueChange={(item: CollectionItem | null) => {
            setSelectedCollection(item?.value ?? '');
          }}
        >
          <ComboboxInput
            className="bg-background"
            placeholder="Search collections..."
          />
          <ComboboxContent>
            <ComboboxEmpty>No collection found.</ComboboxEmpty>
            <ComboboxList>
              {(item: CollectionItem) => (
                <ComboboxItem key={item.value} value={item}>
                  {item.label}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
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
