import { IDict, IJGISLayer, IJupyterGISModel } from '@jupytergis/schema';
import { UUID } from '@lumino/coreutils';
import React, { useEffect, useMemo } from 'react';
import {
  ToggleGroup,
  ToggleGroupItem
} from '../../shared/components/ToggleGroup';
import { datasets } from '../StacBrowser';
import { IStacSearchResult } from '../types/types';

interface IStacCollectionsProps {
  header: string;
  data: IDict<string[]>;
  selectedCollections: string[];
  selectedPlatforms: string[];
  handleToggleGroupValueChange: (val: string[]) => void;
  model: IJupyterGISModel;
}

const apiUrl = 'https://geodes-portal.cnes.fr/api/stac/search';

const StacSections = ({
  header,
  data,
  selectedCollections,
  selectedPlatforms,
  handleToggleGroupValueChange,
  model
}: IStacCollectionsProps) => {
  // ! Starts here

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
      const body = {
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
          platform: {
            in: selectedPlatforms
          }
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
      // ^?
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

    fetchInEffect();
  }, [selectedCollections, selectedPlatforms]);

  async function fetchWithProxy(options: { [key: string]: any }) {
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

  const items = useMemo(() => {
    if (header === 'Collection') {
      return Object.entries(data).map(([key, val]) => (
        <ToggleGroupItem
          key={key}
          className="jgis-stac-browser-collection-item"
          value={key}
        >
          {key}
        </ToggleGroupItem>
      ));
    } else if (header === 'Platform') {
      return Object.entries(data)
        .filter(([key]) => selectedCollections.includes(key))
        .flatMap(([key, values]) =>
          values.map(val => (
            <ToggleGroupItem
              key={`${key}-${val}`}
              className="jgis-stac-browser-collection-item"
              value={val}
            >
              {val}
            </ToggleGroupItem>
          ))
        );
    }
    return null;
  }, [header, data, selectedCollections]);

  return (
    <div>
      <span style={{ fontWeight: 'bold' }}>{header}</span>
      <ToggleGroup
        type="multiple"
        variant={'outline'}
        size={'sm'}
        className="jgis-stac-browser-collection"
        onValueChange={handleToggleGroupValueChange}
      >
        {items}
      </ToggleGroup>
    </div>
  );
};

export default StacSections;
