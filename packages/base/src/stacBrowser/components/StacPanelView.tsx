import React, { useEffect, useState } from 'react';
import { IStacViewProps } from '../StacBrowser';
import StacSections from './StacSection';

const StacPanelView = ({
  datasets,
  platforms,
  model,
  products,
  displayInfo,
  handleCategoryClick,
  handleSearchInput,
  handleTileClick,
  searchTerm,
  selectedCategory
}: IStacViewProps) => {
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  useEffect(() => {
    console.log('selectedCollections', selectedCollections);
  }, [selectedCollections]);

  if (!model) {
    return <div>Loading model</div>;
  }

  return (
    <div className="jgis-stac-browser-main">
      <div>save/load filter</div>
      <div>date time picker</div>
      <div>where</div>
      <StacSections
        header="Collection"
        data={datasets}
        selectedCollections={selectedCollections}
        handleToggleGroupValueChange={(val: string[]) => {
          setSelectedCollections(val);
        }}
        selectedPlatforms={selectedPlatforms}
        model={model}
      />
      <StacSections
        header="Platform"
        data={platforms}
        selectedCollections={selectedCollections}
        handleToggleGroupValueChange={(val: string[]) => {
          setSelectedPlatforms(val);
        }}
        selectedPlatforms={selectedPlatforms}
        model={model}
      />
      <div>data/ product</div>
      <div>cloud cover</div>
    </div>
  );
};

export default StacPanelView;
