import React, { ChangeEvent } from 'react';
import { IStacItem } from '../types/types';

interface IStacGridView {
  searchTerm: string;
  handleSearchInput: (event: ChangeEvent<HTMLInputElement>) => void;
  datasetsMap: { [key: string]: string[] };
  selectedCategory: string | null;
  handleCategoryClick: (category: string) => void;
  handleTileClick: (id: string) => void;
  displayInfo?: IStacItem[];
}

const StacGridView = ({
  datasetsMap,
  displayInfo,
  handleCategoryClick,
  handleSearchInput,
  handleTileClick,
  searchTerm,
  selectedCategory
}: IStacGridView) => {
  return (
    <div className="jGIS-layer-browser-container">
      <div className="jGIS-layer-browser-header-container">
        <div className="jGIS-layer-browser-header">
          <h2 className="jGIS-layer-browser-header-text">STAC Browser</h2>
          <div className="jGIS-layer-browser-header-search-container">
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={handleSearchInput}
              className="jGIS-layer-browser-header-search"
            />
          </div>
        </div>

        <div className="jGIS-layer-browser-categories">
          {Object.keys(datasetsMap).map(key => (
            <span
              className={`jGIS-layer-browser-category ${
                selectedCategory === key
                  ? 'jGIS-layer-browser-category-selected'
                  : ''
              }`}
              onClick={() => handleCategoryClick(key)}
            >
              {key}
            </span>
          ))}
        </div>
      </div>
      <div className="jGIS-layer-browser-grid">
        {displayInfo?.map(collection => (
          <div
            className="jGIS-layer-browser-tile"
            onClick={() => handleTileClick(collection.id)}
          >
            <div className="jGIS-layer-browser-tile-img-container">
              <img
                className="jGIS-layer-browser-img"
                src={Object.values(collection.assets).at(-1)?.href}
              />
            </div>
            <div className="jGIS-layer-browser-text-container">
              <div className="jGIS-layer-browser-text-info">
                <h3 className="jGIS-layer-browser-text-header jGIS-layer-browser-text-general">
                  {Object.values(collection.assets).at(-1)?.title}
                </h3>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
export default StacGridView;
