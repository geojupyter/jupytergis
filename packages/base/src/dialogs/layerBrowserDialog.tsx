import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  IJGISFormSchemaRegistry,
  IJGISLayerDocChange,
  IJupyterGISModel,
  IRasterLayerGalleryEntry
} from '@jupytergis/schema';
import { Dialog } from '@jupyterlab/apputils';
import { PromiseDelegate } from '@lumino/coreutils';
import { Signal } from '@lumino/signaling';
import React, { ChangeEvent, useEffect, useState } from 'react';

import CUSTOM_RASTER_IMAGE from '../../rasterlayer_gallery/custom_raster.png';
import LayerGrid from './browsers/components/LayerGrid';
import { CreationFormWrapper } from './layerCreationFormDialog';

interface ILayerBrowserDialogProps {
  model: IJupyterGISModel;
  registry: IRasterLayerGalleryEntry[];
  formSchemaRegistry: IJGISFormSchemaRegistry;
  okSignalPromise: PromiseDelegate<Signal<Dialog<any>, number>>;
  cancel: () => void;
}

export const LayerBrowserComponent = ({
  model,
  registry,
  formSchemaRegistry,
  okSignalPromise,
  cancel
}: ILayerBrowserDialogProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeLayers, setActiveLayers] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [creatingCustomRaster, setCreatingCustomRaster] = useState(false);

  const [galleryWithCategory, setGalleryWithCategory] =
    useState<IRasterLayerGalleryEntry[]>(registry);

  const providers = [
    ...new Set(
      registry
        .map(item => item.source.provider)
        .filter(provider => provider !== undefined)
    )
  ];

  const filteredGallery = galleryWithCategory.filter(item =>
    item.name.toLowerCase().includes(searchTerm)
  );

  useEffect(() => {
    model.sharedModel.layersChanged.connect(handleLayerChange);

    return () => {
      model.sharedModel.layersChanged.disconnect(handleLayerChange);
    };
  }, []);

  /**
   * Track which layers are currently added to the map
   */
  const handleLayerChange = (_: any, change: IJGISLayerDocChange) => {
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

  const handleCategoryClick = (category: string) => {
    const sameAsOld = category === selectedCategory;

    const filteredGallery = sameAsOld
      ? registry
      : registry.filter(item => item.source.provider?.includes(category));

    setGalleryWithCategory(filteredGallery);
    setSearchTerm('');
    setSelectedCategory(sameAsOld ? null : category);
  };

  const handleCustomTileClick = () => {
    setCreatingCustomRaster(true);
  };

  /**
   * Add tile layer and source to model
   * @param tile Tile to add
   */
  // const handleTileClick = (tile: IRasterLayerGalleryEntry) => {
  //   const sourceId = UUID.uuid4();

  //   const sourceModel: IJGISSource = {
  //     type: 'RasterSource',
  //     name: tile.name,
  //     parameters: tile.source
  //   };

  //   const layerModel: IJGISLayer = {
  //     type: 'RasterLayer',
  //     parameters: {
  //       source: sourceId
  //     },
  //     visible: true,
  //     name: tile.name + ' Layer'
  //   };

  //   model.sharedModel.addSource(sourceId, sourceModel);
  //   model.addLayer(UUID.uuid4(), layerModel);
  // };

  if (creatingCustomRaster) {
    // Disconnect any previous handler
    okSignalPromise.promise.then(value => {
      value.disconnect(cancel, this);
    });

    return (
      <div className="jGIS-customlayer-form">
        <CreationFormWrapper
          model={model}
          formSchemaRegistry={formSchemaRegistry}
          createLayer={true}
          createSource={true}
          layerType={'RasterLayer'}
          sourceType={'RasterSource'}
          layerData={{
            name: 'Custom Raster'
          }}
          sourceData={{
            url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            maxZoom: 24,
            minZoom: 0,
            attribution: '(C) OpenStreetMap contributors'
          }}
          okSignalPromise={okSignalPromise}
          cancel={cancel}
        />
      </div>
    );
  }

  // Ok is like cancel in the case of gallery item selections
  okSignalPromise.promise.then(value => {
    value.connect(cancel, this);
  });

  return (
    <div className="jGIS-layer-browser-container">
      <div className="jGIS-layer-browser-header-container">
        <div className="jGIS-layer-browser-header">
          <h2 className="jGIS-layer-browser-header-text">Layer Browser</h2>
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
          {providers.map(provider => (
            <span
              className={`jGIS-layer-browser-category ${
                selectedCategory === provider
                  ? 'jGIS-layer-browser-category-selected'
                  : ''
              }`}
              onClick={() => handleCategoryClick(provider)}
            >
              {provider}
            </span>
          ))}
        </div>
      </div>
      <div className="jGIS-layer-browser-grid">
        <div
          className="jGIS-layer-browser-tile jGIS-layer-browser-custom-tile"
          onClick={() => handleCustomTileClick()}
        >
          <div className="jGIS-layer-browser-tile-img-container">
            <img className="jGIS-layer-browser-img" src={CUSTOM_RASTER_IMAGE} />
            <div className="jGIS-layer-browser-icon">
              <FontAwesomeIcon style={{ height: 20 }} icon={faPlus} />
            </div>
          </div>
          <div className="jGIS-layer-browser-text-container">
            <div className="jGIS-layer-browser-text-info">
              <h3 className="jGIS-layer-browser-text-header jGIS-layer-browser-text-general">
                Custom Raster Layer
              </h3>
            </div>
            <p className="jGIS-layer-browser-text-general jGIS-layer-browser-text-source">
              Create A Custom Raster Layer
            </p>
          </div>
        </div>
        <LayerGrid
          layers={filteredGallery}
          activeLayers={activeLayers}
          model={model}
        />
      </div>
    </div>
  );
};
