import React, { useEffect, useState } from 'react';
import { IStacViewProps } from '../StacBrowser';
import StacSections from './StacSection';

const StacPanelView = ({
  datasets,
  platforms,
  products,
  displayInfo,
  handleCategoryClick,
  handleSearchInput,
  handleTileClick,
  searchTerm,
  selectedCategory
}: IStacViewProps) => {
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);

  const handleToggleGroupValueChange = (val: string[]) => {
    setSelectedCollections(val);
  };

  useEffect(() => {
    console.log('selectedCollections', selectedCollections);
  }, [selectedCollections]);

  return (
    <div className="jgis-stac-browser-main">
      <div>save/load filter</div>
      <div>date time picker</div>
      <div>where</div>
      <StacSections
        header="Collection"
        data={datasets}
        selectedCollections={selectedCollections}
        handleToggleGroupValueChange={handleToggleGroupValueChange}
      />
      <StacSections
        header="Platform"
        data={platforms}
        selectedCollections={selectedCollections}
      />
      <div>data/ product</div>
      <div>cloud cover</div>
    </div>
  );
};

export default StacPanelView;
