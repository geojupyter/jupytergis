import React from 'react';

import { useStacResultsContext } from '@/src/features/stac-browser/context/StacResultsContext';

function StacWmsCollectionResult() {
  const { wmsCollection } = useStacResultsContext();

  if (!wmsCollection) {
    return null;
  }

  return (
    <div className="jgis-stac-panel-placeholder">
      {`${wmsCollection.title} is a WMS layer (${wmsCollection.layerName}). Individual items are not listed.`}
    </div>
  );
}

export default StacWmsCollectionResult;
