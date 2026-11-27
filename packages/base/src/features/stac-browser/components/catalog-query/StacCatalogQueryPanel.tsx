import { IJupyterGISModel } from '@jupytergis/schema';
import React from 'react';

import StacSpatialExtent from '@/src/features/stac-browser/components/shared/StacSpatialExtent';
import StacTemporalExtent from '@/src/features/stac-browser/components/shared/StacTemporalExtent';
import { useStacResultsContext } from '@/src/features/stac-browser/context/StacResultsContext';
import { useStacCatalogQuery } from '@/src/features/stac-browser/hooks/useStacCatalogQuery';
import { Button } from '@/src/shared/components/Button';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from '@/src/shared/components/Combobox';

interface IStacCatalogQueryPanelProps {
  model?: IJupyterGISModel;
}

type CollectionItem = {
  value: string;
  label: string;
};

function StacCatalogQueryPanel({ model }: IStacCatalogQueryPanelProps) {
  const { selectedUrl } = useStacResultsContext();
  const {
    collections,
    selectedCollection,
    selectCollection,
    startTime,
    setStartTime,
    endTime,
    setEndTime,
    useWorldBBox,
    setUseWorldBBox,
    isLoadingCollections,
    collectionsError,
  } = useStacCatalogQuery({ model, baseUrl: selectedUrl });

  const collectionItems: CollectionItem[] = collections.map(collection => ({
    value: collection.id,
    label: collection.title || collection.id,
  }));
  const selectedItem =
    collectionItems.find(item => item.value === selectedCollection) ?? null;

  if (!model) {
    return null;
  }

  return (
    <>
      <div className="jgis-stac-filter-extension-section">
        <StacTemporalExtent
          startTime={startTime}
          endTime={endTime}
          setStartTime={setStartTime}
          setEndTime={setEndTime}
        />
      </div>
      <div className="jgis-stac-filter-extension-section">
        <StacSpatialExtent
          checked={useWorldBBox}
          onCheckedChange={setUseWorldBBox}
          label="Use entire world"
        />
      </div>
      <div className="jgis-stac-filter-extension-section">
        <label className="jgis-stac-filter-extension-label">Collection</label>
        <Combobox
          items={collectionItems}
          itemToStringValue={(item: CollectionItem) => item.label}
          value={selectedItem}
          onValueChange={(item: CollectionItem | null) => {
            selectCollection(item?.value ?? '');
          }}
        >
          <ComboboxTrigger
            className={'border-input'}
            render={
              <Button
                variant="outline"
                className="h-auto min-h-8 justify-between text-left whitespace-normal"
              />
            }
          >
            <span className="flex-1 wrap-break-word">
              <ComboboxValue placeholder="Select a collection..." />
            </span>
          </ComboboxTrigger>
          <ComboboxContent>
            <ComboboxInput
              placeholder="Search collections..."
              showTrigger={false}
            />
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
        {isLoadingCollections ? (
          <span className="jgis-stac-filter-extension-label">
            Loading collections…
          </span>
        ) : null}
        {collectionsError ? (
          <span className="jgis-stac-filter-extension-label">
            {collectionsError}
          </span>
        ) : null}
      </div>
    </>
  );
}

export default StacCatalogQueryPanel;
