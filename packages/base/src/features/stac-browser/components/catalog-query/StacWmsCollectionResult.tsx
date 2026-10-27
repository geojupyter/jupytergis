import { IJupyterGISModel } from '@jupytergis/schema';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import React, { useCallback, useState } from 'react';

import { ICatalogWmsEndpoint } from '@/src/features/stac-browser/catalogQuery';
import { useStacResultsContext } from '@/src/features/stac-browser/context/StacResultsContext';
import { addCatalogWmsToMap } from '@/src/features/stac-browser/hooks/useStacCatalogQuery';
import { Button } from '@/src/shared/components/Button';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/src/shared/components/NativeSelect';
import { buildProxyUrl } from '@/src/shared/proxy';

interface IStacWmsCollectionResultProps {
  model?: IJupyterGISModel;
}

function StacWmsCollectionResult({ model }: IStacWmsCollectionResultProps) {
  const { wmsCollection, wmsCollections, selectCatalogCollection } =
    useStacResultsContext();
  const [layerChoice, setLayerChoice] = useState<{
    collectionId: string;
    layerKey: string;
  } | null>(null);

  const index = wmsCollection
    ? wmsCollections.findIndex(item => item.id === wmsCollection.id)
    : -1;
  const selectedLayer =
    wmsCollection && wmsCollection.layers.length > 0
      ? selectedWmsLayer(wmsCollection.id, wmsCollection.layers, layerChoice)
      : undefined;

  const handlePrevious = useCallback(() => {
    const previous = wmsCollections[index - 1];
    if (previous) {
      selectCatalogCollection(previous.id);
    }
  }, [index, selectCatalogCollection, wmsCollections]);

  const handleNext = useCallback(() => {
    const next = wmsCollections[index + 1];
    if (next) {
      selectCatalogCollection(next.id);
    }
  }, [index, selectCatalogCollection, wmsCollections]);

  const handleAddToMap = useCallback(() => {
    if (!model || !wmsCollection || !selectedLayer) {
      return;
    }
    addCatalogWmsToMap(model, wmsCollection, selectedLayer);
  }, [model, selectedLayer, wmsCollection]);

  const handleLayerChange = useCallback(
    (layerKey: string) => {
      if (!wmsCollection) {
        return;
      }
      setLayerChoice({ collectionId: wmsCollection.id, layerKey });
    },
    [wmsCollection],
  );

  if (!wmsCollection || index < 0 || !selectedLayer) {
    return null;
  }

  const extent = formatExtent(wmsCollection.start, wmsCollection.end);

  return (
    <div className="jgis-stac-wms-result">
      <div className="jgis-stac-wms-result-nav">
        <Button
          variant="ghost"
          size="sm"
          aria-label="Previous collection"
          disabled={index <= 0}
          onClick={handlePrevious}
        >
          <ChevronLeftIcon data-icon="inline-start" />
          Previous
        </Button>
        <span className="jgis-stac-wms-result-position">
          {`${index + 1} / ${wmsCollections.length}`}
        </span>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Next collection"
          disabled={index >= wmsCollections.length - 1}
          onClick={handleNext}
        >
          Next
          <ChevronRightIcon data-icon="inline-end" />
        </Button>
      </div>
      <article className="jgis-stac-wms-result-card">
        {wmsCollection.previewHref ? (
          <CollectionPreview
            key={wmsCollection.previewHref}
            href={wmsCollection.previewHref}
            model={model}
          />
        ) : null}
        <h3 className="jgis-stac-wms-result-title">{wmsCollection.title}</h3>
        {extent ? (
          <p className="jgis-stac-wms-result-extent">{extent}</p>
        ) : null}
        {wmsCollection.description ? (
          <p className="jgis-stac-wms-result-description">
            {wmsCollection.description}
          </p>
        ) : null}
        <label
          className="jgis-stac-filter-extension-label"
          htmlFor="jgis-stac-wms-layer"
        >
          Layer
        </label>
        <NativeSelect
          id="jgis-stac-wms-layer"
          className="w-full"
          value={wmsLayerKey(selectedLayer)}
          onChange={event => {
            handleLayerChange(event.target.value);
          }}
        >
          {wmsCollection.layers.map(layer => (
            <NativeSelectOption
              key={wmsLayerKey(layer)}
              value={wmsLayerKey(layer)}
            >
              {layer.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button className="jgis-stac-wms-result-add" onClick={handleAddToMap}>
          Add to map
        </Button>
      </article>
    </div>
  );
}

interface ICollectionPreviewProps {
  href: string;
  model?: IJupyterGISModel;
}

function CollectionPreview({ href, model }: ICollectionPreviewProps) {
  const [src, setSrc] = useState(href);
  const [isHidden, setIsHidden] = useState(false);

  const handleError = useCallback(() => {
    const proxied = buildProxyUrl(model, href, true);
    if (src !== proxied) {
      setSrc(proxied);
      return;
    }
    setIsHidden(true);
  }, [href, model, src]);

  if (isHidden) {
    return null;
  }

  return (
    <img
      className="jgis-stac-wms-result-preview"
      src={src}
      alt=""
      onError={handleError}
    />
  );
}

function wmsLayerKey(layer: ICatalogWmsEndpoint): string {
  return `${layer.url}|${layer.layers}`;
}

function selectedWmsLayer(
  collectionId: string,
  layers: ICatalogWmsEndpoint[],
  choice: { collectionId: string; layerKey: string } | null,
): ICatalogWmsEndpoint {
  if (choice?.collectionId === collectionId) {
    const match = layers.find(layer => wmsLayerKey(layer) === choice.layerKey);
    if (match) {
      return match;
    }
  }
  return layers[0];
}

function formatExtent(start: string | null, end: string | null): string | null {
  const startLabel = formatDate(start);
  const endLabel = formatDate(end);
  if (startLabel && endLabel) {
    return `${startLabel} – ${endLabel}`;
  }
  return startLabel ?? endLabel;
}

function formatDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

export default StacWmsCollectionResult;
