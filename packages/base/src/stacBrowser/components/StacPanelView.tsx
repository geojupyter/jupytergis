import React from 'react';
import { IStacViewProps } from '../types/types';

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
      <div>collections</div>
      <div>platform</div>
      <div>data/ product</div>
      <div>cloud cover</div>
    </div>
  );
};

export default StacPanelView;
