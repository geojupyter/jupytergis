import { IJGISLayer } from '@jupytergis/schema';
import { UUID } from '@lumino/coreutils';
import React, { useEffect, useState } from 'react';
import { IStacViewProps } from '../StacBrowser';
import { IStacQueryBody, IStacSearchResult } from '../types/types';
import StacSections from './StacSection';

const apiUrl = 'https://geodes-portal.cnes.fr/api/stac/search';

const StacPanelView = ({
  datasets,
  platforms,
  model,
  products,
  displayInfo,
  handleCategoryClick,
  handleSearchInput,
  handleTileClick,
  searchTerm,
  selectedCategory
}: IStacViewProps) => {
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  useEffect(() => {
    console.log('selectedCollections', selectedCollections);
  }, [selectedCollections]);

  if (!model) {
    return <div>Loading model</div>;
  }

  const [isFirstRender, setIsFirstRender] = useState(false);

  useEffect(() => {
    // Geodes behavior => query on every selection
    console.log('sc', selectedCollections);

    console.log('sp', selectedPlatforms);

    const selectedDatasets = Object.entries(datasets)
      .filter(([key]) => selectedCollections.includes(key))
      .flatMap(([_, values]) => values);

    console.log('selectedDatasets', selectedDatasets);

    // Build query
    const fetchInEffect = async () => {
      const body: IStacQueryBody = {
        bbox: [-180, -65.76350697055292, 180, 65.76350697055292],
        limit: 12,
        page: 1,
        query: {
          dataset: {
            in: selectedDatasets
          },
          end_datetime: {
            gte: '2025-05-27T09:21:00.000Z'
          },
          latest: {
            eq: true
          },
          // Only include platforms in query if there's a selection
          ...(selectedPlatforms.length > 0 && {
            platform: { in: selectedPlatforms }
          })
        },
        sortBy: [
          {
            direction: 'desc',
            field: 'start_datetime'
          }
        ]
      };

      console.log('body', body);

      // TODO: Don't call this on render.
      const result = await fetchWithProxy(body); // this result is ItemCollection
      console.log('result', result);

      // ! MAKEH DAH LAYAH
      const layerId = UUID.uuid4();

      const layerModel: IJGISLayer = {
        type: 'StacLayer',
        parameters: {
          data: result
        },
        visible: true,
        name: 'STAC Layer'
      };

      model.addLayer(layerId, layerModel);
    };

    // TODO: Do this better. Really don't use an effect
    if (!isFirstRender) {
      fetchInEffect();
    }

    if (isFirstRender) {
      setIsFirstRender(false);
    }
  }, [selectedCollections, selectedPlatforms]);

  async function fetchWithProxy(options: IStacQueryBody) {
    // Needed for POST
    const xsrfToken = document.cookie.match(/_xsrf=([^;]+)/)?.[1];

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

      return data;
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }

  return (
    <div className="jgis-stac-browser-main">
      <div>save/load filter</div>
      <div>date time picker</div>
      <div>where</div>
      <StacSections
        header="Collection"
        data={datasets}
        selectedCollections={selectedCollections}
        handleToggleGroupValueChange={(val: string[]) => {
          setSelectedCollections(val);
        }}
        selectedPlatforms={selectedPlatforms}
        model={model}
      />
      <StacSections
        header="Platform"
        data={platforms}
        selectedCollections={selectedCollections}
        handleToggleGroupValueChange={(val: string[]) => {
          setSelectedPlatforms(val);
        }}
        selectedPlatforms={selectedPlatforms}
        model={model}
      />
      <div>data/ product</div>
      <div>cloud cover</div>
    </div>
  );
};

export default StacPanelView;
