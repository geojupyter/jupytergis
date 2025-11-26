import { IJGISLayer, IJupyterGISModel } from '@jupytergis/schema';
import { UUID } from '@lumino/coreutils';
import {
  endOfToday,
  endOfTomorrow,
  startOfToday,
  startOfYesterday,
} from 'date-fns';
import React, { useEffect, useState } from 'react';

import { fetchWithProxies } from '@/src/tools';
import StacCheckboxWithLabel from './shared/StacCheckboxWithLabel';
import StacQueryableFilterList from './shared/StacQueryableFilterList';
import StacSearchDatePicker from './shared/StacSearchDatePicker';
import useStacSearch from '../hooks/useStacSearch';
import { IStacAsset, IStacCollection } from '../types/types';

interface IStacBrowser2Props {
  model?: IJupyterGISModel;
}

type FilteredCollection = Pick<IStacCollection, 'id' | 'title'>;

// {
// title?: string;
// id: string;
// };

const API_URL = 'https://stac.dataspace.copernicus.eu/v1/';
// This is a generic UI for apis that support filter extension
function StacGenericFilterPanel({ model }: IStacBrowser2Props) {
  const [queryableProps, setQueryableProps] = useState<[string, any][]>();
  const [collections, setCollections] = useState<FilteredCollection[]>([]);
  // temp
  const [selectedCollection, setSelectedCollection] = useState('');
  const [currentBBox, setCurrentBBox] = useState<
    [number, number, number, number]
  >([-180, -90, 180, 90]);

  const {
    startTime,
    endTime,
    setStartTime,
    setEndTime,
    useWorldBBox,
    setUseWorldBBox,
  } = useStacSearch({
    model,
  });

  if (!model) {
    console.log('no model');
    return;
  }

  // for collections
  useEffect(() => {
    const fatch = async () => {
      const data = await fetchWithProxies(
        API_URL + 'collections',
        model,
        async response => await response.json(),
        undefined,
        'internal',
      );

      const collections: FilteredCollection[] = data.collections
        .map((collection: any) => ({
          title: collection.title ?? collection.id,
          id: collection.id,
        }))
        .sort((a: FilteredCollection, b: FilteredCollection) => {
          const titleA = a.title?.toLowerCase() ?? '';
          const titleB = b.title?.toLowerCase() ?? '';
          return titleA.localeCompare(titleB);
        });

      console.log('collections', collections);
      setCollections(collections);
    };

    fatch();
  }, []);

  // for queryables
  // should listen for colletion changes and requery
  // need a way to handle querying multiple collections without refetching everything
  // collection id -> queryables map as a basic cache thing??
  useEffect(() => {
    const fatch = async () => {
      const data = await fetchWithProxies(
        API_URL + 'queryables',
        model,
        async response => await response.json(),
        undefined,
        'internal',
      );

      setQueryableProps(Object.entries(data.properties));
    };

    fatch();
  }, []);

  useEffect(() => {
    const listenToModel = (
      sender: IJupyterGISModel,
      bBoxIn4326: [number, number, number, number],
    ) => {
      if (useWorldBBox) {
        setCurrentBBox([-180, -90, 180, 90]);
      } else {
        setCurrentBBox(bBoxIn4326);
      }
    };

    model?.updateBboxSignal.connect(listenToModel);

    return () => {
      model?.updateBboxSignal.disconnect(listenToModel);
    };
  }, [model, useWorldBBox]);

  const handleSubmit = async () => {
    const XSRF_TOKEN = document.cookie.match(/_xsrf=([^;]+)/)?.[1];

    const st = startTime
      ? startTime.toISOString()
      : startOfToday().toISOString();

    const et = endTime ? endTime.toISOString() : endOfToday().toISOString();

    const body = {
      bbox: currentBBox,
      collections: [selectedCollection],
      // really want this as a range? i guess it doesnt matter?
      // should really just not have it if unset
      datetime: `${st}/${et}`,
      limit: 12,
    };

    console.log('body', body);

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-XSRFToken': XSRF_TOKEN,
        credentials: 'include',
      },
      body: JSON.stringify(body),
    };

    const data: any = await fetchWithProxies(
      'https://stac.dataspace.copernicus.eu/v1/search',
      model,
      async response => await response.json(),
      //@ts-expect-error Jupyter requires X-XSRFToken header
      options,
      'internal',
    );

    console.log('data', data);

    // Filter assets to only include items with 'overview' or 'thumbnail' roles
    if (data.features && data.features.length > 0 && data.features[0].assets) {
      const originalAssets = data.features[0].assets;
      const filteredAssets: Record<string, any> = {};

      // Iterate through each asset in the assets object
      for (const [key, asset] of Object.entries(originalAssets)) {
        const assetObj = asset as IStacAsset;
        if (assetObj && assetObj.roles) {
          // Handle both array and string role values
          const roles = assetObj.roles;

          if (roles.includes('thumbnail') || roles.includes('overview')) {
            filteredAssets[key] = assetObj;
          }
        }
      }

      console.log('originalAssets', originalAssets);
      console.log('filteredAssets', filteredAssets);
      // Replace assets with filtered version
      data.features[0].assets = filteredAssets;
    }

    addToMap(data.features[0]);
  };

  const addToMap = (stacData: any) => {
    const layerId = UUID.uuid4();
    // const stacData = results.find(item => item.id === id);

    if (!stacData) {
      console.error('Result not found:');
      return;
    }

    const layerModel: IJGISLayer = {
      type: 'StacLayer',
      parameters: { data: stacData },
      visible: true,
      name: stacData.properties.title ?? stacData.id,
    };

    model && model.addLayer(layerId, layerModel);
  };

  return (
    <div>
      {/* fake api choice */}
      <span>API: {API_URL}</span>
      {/* temporal extent  */}
      <StacSearchDatePicker
        startTime={startTime}
        endTime={endTime}
        setStartTime={setStartTime}
        setEndTime={setEndTime}
      />

      {/* spatial extent  */}
      <StacCheckboxWithLabel
        checked={useWorldBBox}
        onCheckedChange={setUseWorldBBox}
        label="Use entire world"
      />
      {/* collections */}
      <select
        style={{ maxWidth: '75px' }}
        value={selectedCollection}
        onChange={e => setSelectedCollection(e.target.value)}
      >
        {collections.map((option: FilteredCollection) => (
          <option key={option.id} value={option.id}>
            {option.title}
          </option>
        ))}
      </select>
      {/* items IDs */}
      {/* additional filters - this is where queryables should end up */}
      {queryableProps && (
        <StacQueryableFilterList queryableProps={queryableProps} />
      )}
      {/* sort */}
      {/* items per page */}
      {/* buttons */}
      <button onClick={handleSubmit}>submit</button>
    </div>
  );
}

export default StacGenericFilterPanel;
