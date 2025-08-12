// import { IJupyterGISModel } from '@jupytergis/schema';
// import { Dialog } from '@jupyterlab/apputils';
// import React, { useEffect, useState } from 'react';

// import { AttributeTableWidget } from './attributeTable';

// interface IAttributeTableWidgetProps {
//   model: IJupyterGISModel;
// }

// const AttributeTableDialog: React.FC<IAttributeTableWidgetProps> = ({ model }) => {
//   const [layerId, setLayerId] = useState<string | null>(null);

//   useEffect(() => {
//     const selected = model.localState?.selected?.value;
//     if (selected) {
//       setLayerId(Object.keys(selected)[0]);
//     }
//   }, [model.localState]);

//   if (!layerId) return null;

//   return <AttributeTable model={model} layerId={layerId} />;
// };

// export class AttributeTableWidget extends Dialog<void> {
//   constructor(options: IAttributeTableWidgetProps) {
//     const body = <AttributeTableDialog model={options.model} />;
//     super({ title: 'Attribute Table', body });
//     this.id = 'jupytergis::attributeTableWidget';
//     this.addClass('jp-gis-attribute-table-dialog');
//   }
// }
