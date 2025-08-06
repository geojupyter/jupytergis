import { IJupyterGISModel } from '@jupytergis/schema';
import { Dialog } from '@jupyterlab/apputils';
import React from 'react';
import DataGrid from 'react-data-grid';

import { useGetProperties } from '@/src/dialogs/symbology/hooks/useGetProperties';

export interface IAttributeTableProps {
  model: IJupyterGISModel;
  layerId: string;
}

const AttributeTable: React.FC<IAttributeTableProps> = ({ model, layerId }) => {
  const [columns, setColumns] = React.useState<any[]>([]);
  const [rows, setRows] = React.useState<any[]>([]);

  React.useEffect(() => {
    const fetchFeatures = async () => {
      // const features = await model.getFeaturesInExtent(layerId);
      const { featureProperties } = useGetProperties({
          layerId,
          model: model,
        });

      if (!featureProperties) {
        setColumns([]);
        setRows([]);
        return;
      }

      // Assume properties of first feature determine columns
      const sample = featureProperties[0] || {};
      const keys = Object.keys(sample);

      const cols = keys.map(key => ({
        key,
        name: key,
        resizable: true,
        sortable: true,
      }));

      const rowData = featureProperties.map((f: any, i: number) => ({
        id: i,
        ...f.properties,
      }));

      setColumns(cols);
      setRows(rowData);
    };

    fetchFeatures();
  }, [model, layerId]);

  return (
    <div style={{ height: '500px' }}>
      <DataGrid columns={columns} rows={rows} />
    </div>
  );
};

export class AttributeTableWidget extends Dialog<void> {
  constructor(model: IJupyterGISModel, layerId: string) {
    const body = <AttributeTable model={model} layerId={layerId} />;

    super({
      title: 'Attribute Table',
      body,
    });

    this.id = 'jupytergis::attributeTable';
    this.addClass('jp-gis-attribute-table-dialog');
  }
}
