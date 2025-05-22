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

// const url = 'https://geodes-portal.cnes.fr/api/stac/collections';

// async function fetchWithCorsProxy(): Promise<any> {
//   const proxyUrl = 'https://corsproxy.io';
//   const magicUrl = `${proxyUrl}/?url=${encodeURIComponent(url)}`;

//   console.log('magicUrl', magicUrl);
//   const response = await fetch(magicUrl);

//   const rj = await response;

//   console.log('cors response', rj);

//   return rj.json();
// }

// async function fetchWithLolProxy(): Promise<any> {
//   const proxyUrl = 'https://api.cors.lol';
//   const magicUrl = `${proxyUrl}/?url=${encodeURIComponent(url)}`;

//   console.log('magicUrl', magicUrl);
//   const response = await fetch(magicUrl);

//   const rj = await response;

//   console.log('lol response', rj);

//   return rj.json();
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

  // async function plainFetch() {
  //   // const response = await fetch(url);
  //   // // console.log('plain response', response);
  //   // const rj = await response.json();
  //   // console.log('rj', rj);
  //   // console.log('type', typeof rj.collections); // its an object

  //   // try {
  //   //   const zero = rj.collections[0];

  //   //   console.log('zero', zero);
  //   //   console.log('rj', rj);
  //   // } catch (error) {
  //   //   console.log('error array', error);
  //   // }

  //   // return rj;

  //   const sdsd = await fetchWithProxies(url, async response => response, null);

  //   console.log('sdsd', sdsd?.json());
  // }

  const apiUrl = 'https://geodes-portal.cnes.fr/api/stac/search';
  async function mockProxyFetch(options: { [key: string]: any }) {
    const searchParams = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(options)
    };

    const proxyUrl = `/jupytergis_core/proxy?url=${encodeURIComponent(apiUrl)}`;

    try {
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(searchParams)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as IStacSearchResult;
      console.log('sb data', data);

      const dd = data.features.map(feature => {
        const fd: IFeatureData = { id: '', title: '', image: '' };

        // each feature has assets
        for (const key in feature.assets) {
          // Assets have the preview jpeg
          const element = feature.assets[key];
          if (element.type === 'image/jpeg') {
            fd.image = element.href;
          }
        }

        fd.id = feature.id;
        fd.title = feature.collection;

        return fd;
      });

      console.log('sb data', data);

      setDisplayInfo(data.features);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }

  const backupFetch = async (options: { [key: string]: any }) => {
    const searchParams = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(options)
    };

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(searchParams)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as IStacSearchResult;

      // const dd = data.features.map(feature => {
      //   const fd: IFeatureData = { id: '', title: '', image: '' };

      //   // each feature has assets
      //   for (const key in feature.assets) {
      //     // Assets have the preview jpeg
      //     const element = feature.assets[key];
      //     if (element.type === 'image/jpeg') {
      //       fd.image = element.href;
      //     }
      //   }

      //   fd.id = feature.id;
      //   fd.title = feature.collection;

      //   return fd;
      // });

      console.log('data', data);

      setDisplayInfo(data.features);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleClick = async (id: string) => {
    if (!displayInfo) {
      return;
    }

    const layerId = UUID.uuid4();
    console.log('layerId', layerId);

    const stacData = displayInfo.find(item => item.id === id);

    console.log('newLayer', stacData);
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

  //? lol this sucks?
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
        <button onClick={() => backupFetch(fetchBody)}>sdsd</button>
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
