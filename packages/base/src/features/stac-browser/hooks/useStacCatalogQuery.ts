import { IJGISLayer, IJupyterGISModel } from '@jupytergis/schema';
import { UUID } from '@lumino/coreutils';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  catalogRoot,
  ICatalogWmsEndpoint,
  pickCollectionWms,
} from '@/src/features/stac-browser/catalogQuery';
import { useStacResultsContext } from '@/src/features/stac-browser/context/StacResultsContext';
import { useStacSearch } from '@/src/features/stac-browser/hooks/useStacSearch';
import {
  IStacCatalogQueryBody,
  IStacCollection,
  IStacCollectionsReturn,
  IStacItem,
} from '@/src/features/stac-browser/types/types';
import { fetchWithProxies } from '@/src/tools';

const SEARCH_LIMIT = 12;

export interface ICatalogCollectionOption {
  id: string;
  title: string;
  start: string | null;
  end: string | null;
}

interface IUseStacCatalogQueryProps {
  model?: IJupyterGISModel;
  baseUrl: string;
}

function toDate(value: string | null): Date | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * Search a STAC catalog with collection, bbox, and product time.
 * Product time uses the query extension (`end_datetime` / `start_datetime`),
 * matching the overlap GEODES already sends. The STAC `datetime` parameter
 * is not sent.
 */
export function useStacCatalogQuery({
  model,
  baseUrl,
}: IUseStacCatalogQueryProps) {
  const { registerBuildQuery, registerAddToMap, executeQuery } =
    useStacResultsContext();
  const {
    currentBBox,
    useWorldBBox,
    setUseWorldBBox,
    hasLoadedInitialSearchState,
  } = useStacSearch({ model });

  const root = catalogRoot(baseUrl);
  const [trackedRoot, setTrackedRoot] = useState(root);
  const [collections, setCollections] = useState<ICatalogCollectionOption[]>(
    [],
  );
  const [selectedCollection, setSelectedCollection] = useState('');
  const [startTime, setStartTime] = useState<Date | undefined>(undefined);
  const [endTime, setEndTime] = useState<Date | undefined>(undefined);
  const [isLoadingCollections, setIsLoadingCollections] = useState(false);
  const [collectionsError, setCollectionsError] = useState<string | undefined>(
    undefined,
  );
  const lastQueryKeyRef = useRef<string | null>(null);
  const selectedCollectionRef = useRef(selectedCollection);
  selectedCollectionRef.current = selectedCollection;

  if (root !== trackedRoot) {
    setTrackedRoot(root);
    setCollections([]);
    setSelectedCollection('');
    setStartTime(undefined);
    setEndTime(undefined);
    setCollectionsError(undefined);
    lastQueryKeyRef.current = null;
  }

  useEffect(() => {
    if (!model || !root) {
      return;
    }

    let cancelled = false;

    const fetchCollections = async () => {
      setIsLoadingCollections(true);
      setCollectionsError(undefined);

      const allCollections: IStacCollection[] = [];
      let nextUrl: string | null = `${root}/collections`;

      while (nextUrl) {
        const page: IStacCollectionsReturn | null = await fetchWithProxies(
          nextUrl,
          model,
          async response => await response.json(),
          undefined,
        );

        if (cancelled) {
          return;
        }

        if (!page?.collections) {
          setCollectionsError('Could not load collections.');
          setCollections([]);
          setIsLoadingCollections(false);
          return;
        }

        allCollections.push(...page.collections);

        const currentPageUrl: string = nextUrl;
        const nextLinkHref: string | undefined = page.links.find(
          link => link.rel === 'next',
        )?.href;

        nextUrl = nextLinkHref
          ? new URL(nextLinkHref, currentPageUrl).toString()
          : null;
      }

      if (cancelled) {
        return;
      }

      const options = allCollections
        .map((collection): ICatalogCollectionOption => {
          const interval = collection.extent?.temporal?.interval?.[0];
          return {
            id: collection.id,
            title: collection.title ?? collection.id,
            start: interval?.[0] ?? null,
            end: interval?.[1] ?? null,
          };
        })
        .sort((a, b) => a.title.localeCompare(b.title));

      setCollections(options);
      setIsLoadingCollections(false);
    };

    void fetchCollections();

    return () => {
      cancelled = true;
    };
  }, [model, root]);

  const selectCollection = useCallback(
    (id: string) => {
      setSelectedCollection(id);
      const collection = collections.find(item => item.id === id);
      setStartTime(toDate(collection?.start ?? null));
      setEndTime(toDate(collection?.end ?? null));
    },
    [collections],
  );

  const buildQuery = useCallback((): IStacCatalogQueryBody => {
    const query: IStacCatalogQueryBody['query'] = {};
    if (startTime) {
      query.end_datetime = { gte: startTime.toISOString() };
    }
    if (endTime) {
      query.start_datetime = { lte: endTime.toISOString() };
    }

    return {
      bbox: currentBBox,
      collections: [selectedCollection],
      limit: SEARCH_LIMIT,
      query,
    };
  }, [currentBBox, endTime, selectedCollection, startTime]);

  useEffect(() => {
    registerBuildQuery(() => buildQuery());
  }, [registerBuildQuery, buildQuery]);

  useEffect(() => {
    if (!model || !root) {
      return;
    }

    registerAddToMap(item => {
      void addCatalogResultToMap(
        model,
        root,
        item,
        selectedCollectionRef.current,
      );
    });
  }, [model, root, registerAddToMap]);

  useEffect(() => {
    if (
      !model ||
      !root ||
      selectedCollection === '' ||
      !hasLoadedInitialSearchState
    ) {
      return;
    }

    const queryBody = buildQuery();
    const searchUrl = `${root}/search`;
    const queryKey = JSON.stringify({ searchUrl, queryBody });
    if (lastQueryKeyRef.current === queryKey) {
      return;
    }
    lastQueryKeyRef.current = queryKey;
    void executeQuery(queryBody, searchUrl);
  }, [
    model,
    root,
    selectedCollection,
    startTime,
    endTime,
    currentBBox,
    hasLoadedInitialSearchState,
    buildQuery,
    executeQuery,
  ]);

  return {
    collections,
    selectedCollection,
    selectCollection,
    startTime,
    setStartTime,
    endTime,
    setEndTime,
    useWorldBBox,
    setUseWorldBBox,
    isLoadingCollections,
    collectionsError,
  };
}

function flyToItem(model: IJupyterGISModel, item: IStacItem): void {
  if (item.geometry) {
    model.flyToGeometrySignal.emit(item.geometry);
    return;
  }
  if (!item.bbox) {
    return;
  }

  const [west, south, east, north] = item.bbox;
  model.flyToGeometrySignal.emit({
    type: 'Polygon',
    coordinates: [
      [
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south],
      ],
    ],
  });
}

function existingWmsLayerId(
  model: IJupyterGISModel,
  endpoint: ICatalogWmsEndpoint,
): string | undefined {
  const sourceId = Object.entries(model.getSources()).find(([, source]) => {
    if (source.type !== 'WmsTileSource') {
      return false;
    }
    const parameters = source.parameters as {
      url?: string;
      params?: { layers?: string };
      useProxy?: boolean;
    };
    return (
      parameters.url === endpoint.url &&
      parameters.params?.layers === endpoint.layers &&
      parameters.useProxy === true
    );
  })?.[0];

  if (!sourceId) {
    return undefined;
  }

  return Object.entries(model.getLayers()).find(([, layer]) => {
    const parameters = layer.parameters as { source?: string };
    return parameters.source === sourceId;
  })?.[0];
}

function addStacItemLayer(model: IJupyterGISModel, item: IStacItem): void {
  const layerId = UUID.uuid4();
  const layerModel: IJGISLayer = {
    type: 'StacLayer',
    parameters: { data: item },
    visible: true,
    name: item.properties?.title ?? item.id,
  };
  model.addLayer(layerId, layerModel);
  model.centerOnPosition(layerId);
}

function addWmsLayer(
  model: IJupyterGISModel,
  endpoint: ICatalogWmsEndpoint,
  collectionTitle: string | undefined,
): void {
  const sourceId = UUID.uuid4();
  const layerId = UUID.uuid4();
  const name = collectionTitle
    ? `${collectionTitle} — ${endpoint.name}`
    : endpoint.name;

  model.sharedModel.addSource(sourceId, {
    name: `${name} Source`,
    type: 'WmsTileSource',
    parameters: {
      url: endpoint.url,
      params: { layers: endpoint.layers },
      useProxy: true,
    },
  });
  model.addLayer(layerId, {
    name,
    type: 'GeoTiffLayer',
    visible: true,
    parameters: { source: sourceId, opacity: 1 },
  });
}

async function addCatalogResultToMap(
  model: IJupyterGISModel,
  root: string,
  item: IStacItem,
  selectedCollection: string,
): Promise<void> {
  const collectionId = item.collection || selectedCollection;
  if (!collectionId) {
    addStacItemLayer(model, item);
    return;
  }

  const collection = await fetchWithProxies(
    `${root}/collections/${encodeURIComponent(collectionId)}`,
    model,
    async response => (await response.json()) as IStacCollection,
    undefined,
  );
  const endpoint = pickCollectionWms(collection?.assets);
  if (!endpoint) {
    addStacItemLayer(model, item);
    return;
  }

  if (!existingWmsLayerId(model, endpoint)) {
    addWmsLayer(model, endpoint, collection?.title);
  }
  flyToItem(model, item);
}
