import { IJupyterGISModel } from '@jupytergis/schema';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import React, { useCallback, useState } from 'react';

import { useStacResultsContext } from '@/src/features/stac-browser/context/StacResultsContext';
import { addCatalogWmsToMap } from '@/src/features/stac-browser/hooks/useStacCatalogQuery';
import { Button } from '@/src/shared/components/Button';
import { INTERNAL_PROXY_BASE } from '@/src/tools';

interface IStacWmsCollectionResultProps {
  model?: IJupyterGISModel;
}

function StacWmsCollectionResult({ model }: IStacWmsCollectionResultProps) {
  const { wmsCollection, wmsCollections, setCatalogCollectionId } =
    useStacResultsContext();

  const index = wmsCollection
    ? wmsCollections.findIndex(item => item.id === wmsCollection.id)
    : -1;

  const handlePrevious = useCallback(() => {
    const previous = wmsCollections[index - 1];
    if (previous) {
      setCatalogCollectionId(previous.id);
    }
  }, [index, setCatalogCollectionId, wmsCollections]);

  const handleNext = useCallback(() => {
    const next = wmsCollections[index + 1];
    if (next) {
      setCatalogCollectionId(next.id);
    }
  }, [index, setCatalogCollectionId, wmsCollections]);

  const handleAddToMap = useCallback(() => {
    if (!model || !wmsCollection) {
      return;
    }
    addCatalogWmsToMap(model, wmsCollection);
  }, [model, wmsCollection]);

  if (!wmsCollection || index < 0) {
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
        <Button className="jgis-stac-wms-result-add" onClick={handleAddToMap}>
          Add to map
        </Button>
      </article>
    </div>
  );
}

interface ICollectionPreviewProps {
  href: string;
}

function CollectionPreview({ href }: ICollectionPreviewProps) {
  const [src, setSrc] = useState(href);
  const [isHidden, setIsHidden] = useState(false);

  const handleError = useCallback(() => {
    const proxied = `${INTERNAL_PROXY_BASE}?url=${encodeURIComponent(href)}`;
    if (src !== proxied) {
      setSrc(proxied);
      return;
    }
    setIsHidden(true);
  }, [href, src]);

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
