/* eslint-disable @typescript-eslint/no-unused-vars */
import { IJGISLayer, IJupyterGISModel } from '@jupytergis/schema';
import { UUID } from '@lumino/coreutils';
import React, { ChangeEvent, MouseEvent, useEffect, useState } from 'react';
import { IStacItem, IStacSearchResult } from './types';

// Map collection names to the fetch body for the query
const collections = {
  'Sentinel 1': {
    dataset: {
      in: ['PEPS_S2_L1C']
    }
  }
};

// interface IStacRequest {
//   page: number;
//   query: {
//     keywords: {
//       contains: string;
//     };
//   };
// }

// interface IStacResponse {
//   // Define your response type here based on the API documentation
//   features: Array<{
//     id: string;
//     properties: Record<string, unknown>;
//     // ... other fields
//   }>;
// }

// ? Do we even want this? Could just save the whole return instead
interface IFeatureData {
  id: string;
  title: string;
  image: string;
}

interface IStacBrowserDialogProps {
  model: IJupyterGISModel;
  // registry: IRasterLayerGalleryEntry[];
  // formSchemaRegistry: IJGISFormSchemaRegistry;
  // okSignalPromise: PromiseDelegate<Signal<Dialog<any>, number>>;
  // cancel: () => void;
}

const StacBrowser = ({ model }: IStacBrowserDialogProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] =
    useState<HTMLElement | null>();
  const handleSearchInput = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value.toLowerCase());
  };
  const [displayInfo, setDisplayInfo] = useState<IStacItem[]>();

  const fetchBody = {
    limit: 12,
    query: {
      dataset: {
        in: ['PEPS_S2_L1C'] // Sentinel 2
      }
    }
  };

  useEffect(() => {
    console.log('selectedCategory', selectedCategory);

    switch (selectedCategory?.innerText) {
      case 'Sentinel 1':
        mockProxyFetch(fetchBody);
        break;
      default:
        console.log('switch default');
        break;
    }
  }, [selectedCategory]);

  const apiUrl = 'https://geodes-portal.cnes.fr/api/stac/search';

  async function mockProxyFetch(options1: { [key: string]: any }) {
    // Needed for POST
    const xsrfToken = document.cookie.match(/_xsrf=([^;]+)/)?.[1];

    // TODO: Build this from filter selections
    const options = {
      limit: 12,
      query: {
        dataset: {
          in: ['PEPS_S2_L1C'] // Sentinel 2
        }
      }
    };

    const proxyUrl = `/jupytergis_core/proxy?url=${encodeURIComponent(apiUrl)}`;

    try {
      const response = await fetch(proxyUrl, {
        method: 'POST',
        //@ts-expect-error Jupyter requires X-XSRFToken header
        headers: {
          'Content-Type': 'application/json',
          'X-XSRFToken': xsrfToken,
          credentials: 'include'
        },
        body: JSON.stringify(options)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as IStacSearchResult;

      setDisplayInfo(data.features);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }

  const handleClick = async (id: string) => {
    if (!displayInfo) {
      return;
    }

    const layerId = UUID.uuid4();

    const stacData = displayInfo.find(item => item.id === id);

    const layerModel: IJGISLayer = {
      type: 'StacLayer',
      parameters: {
        data: stacData
      },
      visible: true,
      name: 'STAC Layer'
    };

    model.addLayer(layerId, layerModel);
  };

  //? lol this sucks? Can probably just save the text and use a document query to get the actual element
  const handleCategoryClick = (event: MouseEvent<HTMLSpanElement>) => {
    const categoryTab = event.target as HTMLElement;
    const sameAsOld = categoryTab.innerText === selectedCategory?.innerText;

    categoryTab.classList.toggle('jGIS-layer-browser-category-selected');
    selectedCategory?.classList.remove('jGIS-layer-browser-category-selected');

    setSearchTerm('');
    setSelectedCategory(sameAsOld ? null : categoryTab);
  };

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
          {Object.entries(collections).map(([key, value]) => (
            <span
              className="jGIS-layer-browser-category"
              onClick={handleCategoryClick}
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
            onClick={() => handleClick(collection.id)}
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

        {/* <LayerGrid
          layers={filteredGallery}
          activeLayers={activeLayers}
          model={model}
        /> */}
      </div>
    </div>
  );
};
export default StacBrowser;
