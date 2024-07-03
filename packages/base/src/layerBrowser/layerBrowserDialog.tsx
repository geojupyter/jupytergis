import {
  faCheck,
  faMagnifyingGlass,
  faPlus
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  IJGISLayer,
  IJGISLayerDocChange,
  IJGISSource,
  IJupyterGISModel,
  IRasterLayerGalleryEntry
} from '@jupytergis/schema';
import { ReactWidget } from '@jupyterlab/ui-components';
import { UUID } from '@lumino/coreutils';
import React, { ChangeEvent, MouseEvent, useEffect, useState } from 'react';

interface ILayerBrowserDialogProps {
  model: IJupyterGISModel;
  registry: IRasterLayerGalleryEntry[];
}

export const LayerBrowserComponent = ({
  model,
  registry
}: ILayerBrowserDialogProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeLayers, setActiveLayers] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] =
    useState<HTMLElement | null>();

  const [galleryWithCategory, setGalleryWithCategory] =
    useState<IRasterLayerGalleryEntry[]>(registry);

  const providers = [...new Set(registry.map(item => item.source.provider))];

  const filteredGallery = galleryWithCategory.filter(item =>
    item.name.toLowerCase().includes(searchTerm)
  );

  useEffect(() => {
    // Override default dialog style
    const dialog = document.getElementsByClassName('jp-Dialog-content');
    const dialogHeader = document.getElementsByClassName('jp-Dialog-header');
    dialogHeader[0].setAttribute('style', 'padding: 0');
    dialog[0].classList.add('jgis-dialog-override');

    model.sharedModel.layersChanged.connect(handleLayerChange);

    return () => {
      model.sharedModel.layersChanged.disconnect(handleLayerChange);
    };
  }, []);

  /**
   * Track which layers are currently added to the map
   */
  const handleLayerChange = (_, change: IJGISLayerDocChange) => {
    // The split is to get rid of the 'Layer' part of the name to match the names in the gallery
    setActiveLayers(
      Object.values(model.sharedModel.layers).map(
        layer => layer.name.split(' ')[0]
      )
    );
  };

  const handleSearchInput = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value.toLowerCase());
  };

  const handleCategoryClick = (event: MouseEvent<HTMLSpanElement>) => {
    const categoryTab = event.target as HTMLElement;
    const sameAsOld = categoryTab.innerText === selectedCategory?.innerText;

    categoryTab.classList.toggle('jgis-layer-browser-category-selected');
    selectedCategory?.classList.remove('jgis-layer-browser-category-selected');

    const filteredGallery = sameAsOld
      ? registry
      : registry.filter(item =>
          item.source.provider?.includes(categoryTab.innerText)
        );

    setGalleryWithCategory(filteredGallery);
    setSearchTerm('');
    setSelectedCategory(sameAsOld ? null : categoryTab);
  };

  /**
   * Add tile layer and source to model
   * @param tile Tile to add
   */
  const handleTileClick = (tile: IRasterLayerGalleryEntry) => {
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

  return (
    <div className="jgis-layer-browser-container">
      <div className="jgis-layer-browser-header-container">
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
            <span
              className="jgis-layer-browser-category"
              onClick={handleCategoryClick}
            >
              {provider}
            </span>
          ))}
        </div>
      </div>
      <div className="jgis-layer-browser-grid">
        {filteredGallery.map(tile => (
          <div
            className="jgis-layer-browser-tile"
            onClick={() => handleTileClick(tile)}
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
  private _model: IJupyterGISModel;
  private _registry: IRasterLayerGalleryEntry[];

  constructor(model: IJupyterGISModel, registry: IRasterLayerGalleryEntry[]) {
    super();
    this.id = 'jupytergis::layerBrowser';
    this._model = model;
    this._registry = registry;
  }

  render() {
    return (
      <LayerBrowserComponent model={this._model} registry={this._registry} />
    );
  }
}
