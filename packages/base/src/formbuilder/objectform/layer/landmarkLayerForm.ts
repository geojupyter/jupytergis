import { IDict } from '@jupytergis/schema';
import { FieldProps } from '@rjsf/core';
import * as React from 'react';

import { LayerPropertiesForm } from './layerform';
import LandmarkReset from '../components/LandmarkReset';

export class LandmarkLayerPropertiesForm extends LayerPropertiesForm {
  protected processSchema(
    data: IDict<any> | undefined,
    schema: IDict,
    uiSchema: IDict,
  ) {
    super.processSchema(data, schema, uiSchema);

    if (!this.props.model.selected) {
      return;
    }

    let layerId: string | undefined = undefined;
    const selectedKeys = Object.keys(this.props.model.selected);

    // Find the first selected landmark
    // TODO ! we still need to handle selections better, like there should at least be a getFirstSelected
    // ! just do that
    for (const key of selectedKeys) {
      const layer = this.props.model.getLayer(key);
      if (layer && layer.type === 'LandmarkLayer') {
        layerId = key;
        break;
      }
    }

    uiSchema['extent'] = {
      'ui:field': (props: FieldProps) =>
        React.createElement(LandmarkReset, {
          ...props,
          model: this.props.model,
          layerId,
        }),
    };

    uiSchema['content'] = {
      ...uiSchema['content'],
      markdown: {
        'ui:widget': 'textarea',
        'ui:options': {
          rows: 10,
        },
      },
    };

    this.removeFormEntry('zoom', data, schema, uiSchema);
  }
}
