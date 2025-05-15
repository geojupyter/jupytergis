import { faCheck, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IJGISLayer, IJGISSource, IJupyterGISModel } from '@jupytergis/schema';
import { UUID } from '@lumino/coreutils';
import React from 'react';

interface ILayerGridProps {
  layers: any[];
  activeLayers: string[];
  model: IJupyterGISModel;
}

const LayerGrid = ({ layers, activeLayers, model }: ILayerGridProps) => {
  /**
   * Add tile layer and source to model
   * @param tile Tile to add
   */
  const handleTileClick = (tile: any) => {
    const sourceId = UUID.uuid4();

    const sourceModel: IJGISSource = {
      type: 'RasterSource',
      name: tile.name,
      parameters: tile.source
    };

    const layerModel: IJGISLayer = {
      type: 'RasterLayer',
      parameters: {
        source: sourceId
      },
      visible: true,
      name: tile.name + ' Layer'
    };

    model.sharedModel.addSource(sourceId, sourceModel);
    model.addLayer(UUID.uuid4(), layerModel);
  };

  return layers.map(tile => (
    <div
      className="jGIS-layer-browser-tile"
      onClick={() => handleTileClick(tile)}
    >
      <div className="jGIS-layer-browser-tile-img-container">
        <img className="jGIS-layer-browser-img" src={tile.thumbnail} />
        {activeLayers.indexOf(tile.name) === -1 ? (
          <div className="jGIS-layer-browser-icon">
            <FontAwesomeIcon style={{ height: 20 }} icon={faPlus} />
          </div>
        ) : (
          <div className="jGIS-layer-browser-icon jGIS-layer-browser-added">
            <FontAwesomeIcon style={{ height: 20 }} icon={faCheck} />
            <p className="jGIS-layer-browser-text-general">Added!</p>
          </div>
        )}
      </div>
      <div className="jGIS-layer-browser-text-container">
        <div className="jGIS-layer-browser-text-info">
          <h3 className="jGIS-layer-browser-text-header jGIS-layer-browser-text-general">
            {tile.name}
          </h3>
          {/* <p className="jGIS-layer-browser-text-general jGIS-layer-browser-text-description">
                {tile.description}
                placeholder
              </p> */}
        </div>
        <p className="jGIS-layer-browser-text-general jGIS-layer-browser-text-source">
          {tile.source.attribution}
        </p>
      </div>
    </div>
  ));
};

export default LayerGrid;
