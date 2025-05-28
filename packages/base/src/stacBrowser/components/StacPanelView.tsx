import React from 'react';
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
  return (
    <div className="jgis-stac-browser-main">
      <div>save/load filter</div>
      <div>date time picker</div>
      <div>where</div>
      <StacSections header="Collection" data={datasets} />
      <StacSections header="Platform" data={platforms} />
      <div>platform</div>
      <div>data/ product</div>
      <div>cloud cover</div>
    </div>
  );
};

export default StacPanelView;
