import { IJupyterGISModel } from '@jupytergis/schema';
import * as React from 'react';

import { ErrorBanner } from '@/src/shared/components/ErrorBanner';
import { LoadingIcon } from '@/src/shared/components/loading';
import { CrsCard } from './CrsCard';
import { ExtentCard } from './ExtentCard';
import { FieldList, MetadataSection } from './MetadataSection';
import { BandTable, PyramidTable, VectorTable } from './MetadataTables';
import { useLayerMetadata } from '../hooks/useLayerMetadata';

interface IMetadataViewProps {
  model: IJupyterGISModel;
  /** The layer or source to describe. */
  selectedId?: string;
}

/**
 * Read-only view of everything JupyterGIS knows about a layer or source.
 *
 * Sections that a format cannot supply are omitted rather than shown empty, and
 * anything that could not be read is explained in a note at the bottom.
 */
export const MetadataView: React.FC<IMetadataViewProps> = ({
  model,
  selectedId,
}) => {
  const { metadata, loading, error } = useLayerMetadata(model, selectedId);

  if (loading) {
    return (
      <div className="jgis-metadata-view flex items-center justify-center p-6">
        <LoadingIcon />
      </div>
    );
  }

  if (error || !metadata) {
    return (
      <div className="jgis-metadata-view p-2">
        <ErrorBanner
          variant="error"
          message={error ?? 'No information available.'}
        />
      </div>
    );
  }

  return (
    <div className="jgis-metadata-view flex flex-col gap-4 p-1">
      <MetadataSection title="General">
        <FieldList fields={metadata.general} />
      </MetadataSection>

      {metadata.crs ? <CrsCard crs={metadata.crs} /> : null}
      {metadata.extent ? <ExtentCard extent={metadata.extent} /> : null}
      {metadata.vector ? <VectorTable vector={metadata.vector} /> : null}
      {metadata.bands?.length ? <BandTable bands={metadata.bands} /> : null}
      {metadata.pyramid ? <PyramidTable pyramid={metadata.pyramid} /> : null}

      {metadata.extra?.length ? (
        <MetadataSection title="Other">
          <FieldList fields={metadata.extra} />
        </MetadataSection>
      ) : null}

      {metadata.notes?.length ? (
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-xs text-muted-foreground">
          {metadata.notes.map(note => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

export default MetadataView;
