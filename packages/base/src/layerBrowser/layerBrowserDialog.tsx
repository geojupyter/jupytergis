import {
  faCheck,
  faMagnifyingGlass,
  faPlus
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IJGISLayer, IJGISSource, IJupyterGISDoc } from '@jupytergis/schema';
import { ReactWidget } from '@jupyterlab/ui-components';
import { UUID } from '@lumino/coreutils';
import React, { useEffect, useState } from 'react';
import { getRasterLayerGallery } from '../commands';
import { IRasterLayerGalleryEntry } from '../types';

interface ILayerBrowserDialogProps {
  sharedModel: IJupyterGISDoc;
}

export const LayerBrowserComponent = ({
  sharedModel
}: ILayerBrowserDialogProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  //TODO: Temp way to track layers to see icon change
  const [activeLayers, setActiveLayers] = useState<string[]>([]);

  const gallery = getRasterLayerGallery();
  const filteredGallery = gallery.filter(item =>
    item.name.toLowerCase().includes(searchTerm)
  );

  const providers = [...new Set(gallery.map(item => item.source.provider))];

  useEffect(() => {
    const dialog = document.getElementsByClassName('jp-Dialog-content');
    dialog[0].classList.add('jgis-dialog-override');

    sharedModel.layersChanged.connect(handleLayerChange);
  }, []);

  const handleLayerChange = () => {
    // Get rid of the 'Layer' part of the name to match the names in the gallery
    setActiveLayers(
      Object.values(sharedModel.layers).map(layer => layer.name.split(' ')[0])
    );
  };

  const handleSearchInput = event => {
    setSearchTerm(event.target.value.toLowerCase());
  };

  const handleClick = (tile: IRasterLayerGalleryEntry) => {
    const sourceId = UUID.uuid4();

    const sourceModel: IJGISSource = {
      type: 'RasterSource',
      name: tile.name,
      parameters: {
        url: tile.source.url,
        minZoom: tile.source.minZoom,
        maxZoom: tile.source.maxZoom
      }
    };

    const layerModel: IJGISLayer = {
      type: 'RasterLayer',
      parameters: {
        source: sourceId
      },
      visible: true,
      name: tile.name + ' Layer'
    };

    sharedModel.addSource(sourceId, sourceModel);
    sharedModel.addLayer(UUID.uuid4(), layerModel);
  };

  return (
    <div className="jgis-layer-browser-container">
      <div className="jgis-layer-browser-header">
        <h2 className="jgis-layer-browser-header-text">Layer Browser</h2>
        <div className="jgis-layer-browser-header-search-container">
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={handleSearchInput}
            className="jgis-layer-browser-header-search"
          />
          <FontAwesomeIcon
            className="jgis-layer-browser-header-search-icon"
            style={{ height: 20 }}
            icon={faMagnifyingGlass}
          />
        </div>
      </div>
      <div className="jgis-layer-browser-categories">
        {providers.map(provider => (
          <span>{provider}</span>
        ))}
      </div>
      <div className="jgis-layer-browser-grid">
        {filteredGallery.map(tile => (
          <div
            className="jgis-layer-browser-tile"
            onClick={() => handleClick(tile)}
          >
            <div className="jgis-layer-browser-tile-img-container">
              <img className="jgis-layer-browser-img" src={tile.thumbnail} />
              {activeLayers.indexOf(tile.name) === -1 ? (
                <div className="jgis-layer-browser-icon">
                  <FontAwesomeIcon style={{ height: 20 }} icon={faPlus} />
                </div>
              ) : (
                <div className="jgis-layer-browser-icon jgis-layer-browser-added">
                  <FontAwesomeIcon style={{ height: 20 }} icon={faCheck} />
                  <p className="jgis-layer-browser-text-general">Added!</p>
                </div>
              )}
            </div>
            <div className="jgis-layer-browser-text-container">
              <div className="jgis-layer-browser-text-info">
                <h3 className="jgis-layer-browser-text-header jgis-layer-browser-text-general">
                  {tile.name}
                </h3>
                {/* <p className="jgis-layer-browser-text-general jgis-layer-browser-text-description">
                  {tile.description}
                  placeholder
                </p> */}
              </div>
              <p className="jgis-layer-browser-text-general jgis-layer-browser-text-source">
                {tile.source.attribution}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export class LayerBrowserWidget extends ReactWidget {
  sharedModel: IJupyterGISDoc;
  handleClose: void;

  constructor(sharedModel: IJupyterGISDoc) {
    super();
    this.sharedModel = sharedModel;
  }

  render() {
    return <LayerBrowserComponent sharedModel={this.sharedModel} />;
  }
}
