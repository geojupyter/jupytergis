import {
  faCheck,
  faMagnifyingGlass,
  faPlus
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  IDict,
  IJGISFormSchemaRegistry,
  IJGISLayer,
  IJGISLayerDocChange,
  IJGISSource,
  IJupyterGISModel,
  IRasterLayerGalleryEntry
} from '@jupytergis/schema';
import { UUID } from '@lumino/coreutils';
import React, { ChangeEvent, MouseEvent, useEffect, useState } from 'react';
import { RasterSourcePropertiesForm } from '../panelview';
import { deepCopy } from '../tools';
import { Dialog } from '@jupyterlab/apputils';

interface ILayerBrowserDialogProps {
  model: IJupyterGISModel;
  registry: IRasterLayerGalleryEntry[];
  formSchemaRegistry: IJGISFormSchemaRegistry;
  onParentDispose: Promise<boolean>;
}

export const LayerBrowserComponent = ({
  model,
  registry,
  formSchemaRegistry,
  onParentDispose
}: ILayerBrowserDialogProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeLayers, setActiveLayers] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] =
    useState<HTMLElement | null>();
  const [creatingCustomRaster, setCreatingCustomRaster] = useState(false);

  const [galleryWithCategory, setGalleryWithCategory] =
    useState<IRasterLayerGalleryEntry[]>(registry);

  const providers = [...new Set(registry.map(item => item.source.provider))];

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

  const handleCustomTileClick = () => {
    setCreatingCustomRaster(true);
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

  if (creatingCustomRaster) {
    const schema = deepCopy(
      formSchemaRegistry.getSchemas().get('RasterSource')
    );
    if (!schema) {
      return;
    }

    // Inject name in schema
    schema['required'] = ['name', ...schema['required']];
    schema['properties'] = {
      name: { type: 'string', description: 'The name of the raster layer' },
      ...schema['properties']
    };

    const syncData = (props: IDict) => {
      const sharedModel = model.sharedModel;
      if (!sharedModel) {
        return;
      }

      const { name, ...parameters } = props;

      const sourceId = UUID.uuid4();

      const sourceModel: IJGISSource = {
        type: 'RasterSource',
        name,
        parameters: {
          url: parameters.url,
          minZoom: parameters.minZoom,
          maxZoom: parameters.maxZoom
        }
      };

      const layerModel: IJGISLayer = {
        type: 'RasterLayer',
        parameters: {
          source: sourceId
        },
        visible: true,
        name: name + ' Layer'
      };

      sharedModel.addSource(sourceId, sourceModel);
      model.addLayer(UUID.uuid4(), layerModel);
    };

    return (
      <div style={{ overflow: 'hidden' }}>
        <RasterSourcePropertiesForm
          formContext="create"
          model={model}
          sourceData={{
            name: 'Custom Source',
            url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            maxZoom: 24,
            minZoom: 0,
            attribution: '(C) OpenStreetMap contributors'
          }}
          schema={schema}
          syncData={syncData}
          onParentDispose={onParentDispose}
          showSubmitButton={false}
        />
      </div>
    );
  }

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
        <div
          className="jgis-layer-browser-tile"
          onClick={() => handleCustomTileClick()}
        >
          <div className="jgis-layer-browser-tile-img-container">
            <div className="jgis-layer-browser-icon">
              <FontAwesomeIcon style={{ height: 20 }} icon={faPlus} />
            </div>
          </div>
          <div className="jgis-layer-browser-text-container">
            <div className="jgis-layer-browser-text-info">
              <h3 className="jgis-layer-browser-text-header jgis-layer-browser-text-general">
                Custom Raster Layer
              </h3>
            </div>
            <p className="jgis-layer-browser-text-general jgis-layer-browser-text-source">
              Create A Custom Raster Layer
            </p>
          </div>
        </div>
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

export class LayerBrowserWidget extends Dialog<boolean> {
  constructor(
    model: IJupyterGISModel,
    registry: IRasterLayerGalleryEntry[],
    formSchemaRegistry: IJGISFormSchemaRegistry
  ) {
    // This is a bit complex so that "this" is defined
    let _disposeDialog: (result: boolean) => void;
    let _setDisposeDialog: () => void;
    const _onDisposeSet = new Promise<void>(resolve => {
      _setDisposeDialog = resolve;
    });
    const onDispose = new Promise<boolean>(resolve => {
      _disposeDialog = resolve;
      _setDisposeDialog();
    });
    const body = (
      <LayerBrowserComponent
        model={model}
        registry={registry}
        formSchemaRegistry={formSchemaRegistry}
        onParentDispose={onDispose}
      />
    );

    super({ body, buttons: [Dialog.cancelButton(), Dialog.okButton()] });
    _onDisposeSet.then(() => {
      this.disposeDialog = _disposeDialog;
    });

    // Override default dialog style
    const dialog = this.node.getElementsByClassName('jp-Dialog-content');
    const dialogHeader = this.node.getElementsByClassName('jp-Dialog-header');
    dialogHeader[0].setAttribute('style', 'padding: 0');
    dialog[0].classList.add('jgis-dialog-override');
  }

  async launch(): Promise<Dialog.IResult<boolean>> {
    return super.launch().then(result => {
      this.disposeDialog(result.button.accept);

      return result;
    });
  }

  private disposeDialog: (result: boolean) => void;
}
