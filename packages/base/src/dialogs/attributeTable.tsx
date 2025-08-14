import { IJupyterGISModel } from '@jupytergis/schema';
import { Dialog } from '@jupyterlab/apputils';
import React from 'react';
import DataGrid from 'react-data-grid';

import { useGetFeatures } from './symbology/hooks/useGetFeatures';

export interface IAttributeTableProps {
  model: IJupyterGISModel;
  layerId: string;
}

const AttributeTable: React.FC<IAttributeTableProps> = ({ model, layerId }) => {
  const [columns, setColumns] = React.useState<any[]>([]);
  const [rows, setRows] = React.useState<any[]>([]);

  const { features, isLoading, error } = useGetFeatures({ layerId, model });

  React.useEffect(() => {
    if (isLoading) {
      return;
    }
    if (error) {
      console.error('[AttributeTable] Error loading features:', error);
      return;
    }
    if (!features.length) {
      console.warn('[AttributeTable] No features found.');
      setColumns([]);
      setRows([]);
      return;
    }

    const sampleProps = features[0]?.properties ?? {};
    const cols = [
      { key: 'sno', name: 'S. No.', resizable: true, sortable: true },
      ...Object.keys(sampleProps).map(key => ({
        key,
        name: key,
        resizable: true,
        sortable: true
      }))
    ];

    const rowData = features.map((f, i) => ({
      sno: i + 1,
      ...f.properties
    }));

    setColumns(cols);
    setRows(rowData);
  }, [features, isLoading, error]);

  return (
    <div style={{ height: '100%', width: '100%', overflow: 'auto' }}>
      <DataGrid
        columns={columns}
        rows={rows}
        className="rdg-light"
        style={{ minHeight: '100%' }}
      />
    </div>
  );
};

export class AttributeTableWidget extends Dialog<void> {
  constructor(model: IJupyterGISModel, layerId: string) {
    const body = (
      <div style={{ minWidth: '70vw', maxHeight: '80vh' }}>
        <AttributeTable model={model} layerId={layerId} />
      </div>
    );

    super({
      title: 'Attribute Table',
      body
    });

    this.id = 'jupytergis::attributeTable';
    this.addClass('jp-gis-attribute-table-dialog');
  }
}
