import React from 'react';
import StacCollections from './StacCollections';
import { IStacViewProps } from '../StacBrowser';

const StacPanelView = ({
  datasetsMap,
  displayInfo,
  handleCategoryClick,
  handleSearchInput,
  handleTileClick,
  searchTerm,
  selectedCategory
}: IStacViewProps) => {
  return (
    <div className="jgis-stac-browser-main">
      <div>save/load filter</div>
      <div>date time picker</div>
      <div>where</div>
      <StacCollections datasetsMap={datasetsMap} />
      <div>platform</div>
      <div>data/ product</div>
      <div>cloud cover</div>
    </div>
  );
};

export default StacPanelView;
