import { IDict, IStorySegmentLayer } from '@jupytergis/schema';
import { FieldProps } from '@rjsf/core';
import * as React from 'react';

import { LayerPropertiesForm } from './layerform';
import { ArrayFieldTemplate } from '../components/SegmentFormSymbology';
import StorySegmentReset from '../components/StorySegmentReset';

export class StorySegmentLayerPropertiesForm extends LayerPropertiesForm {
  protected processSchema(
    data: IStorySegmentLayer | undefined,
    schema: IDict,
    uiSchema: IDict,
  ) {
    super.processSchema(data, schema, uiSchema);

    if (!this.props.model.selected) {
      return;
    }

    let layerId: string | undefined = undefined;
    const selectedKeys = Object.keys(this.props.model.selected);

    // Find the first selected story segment
    // ! TODO we still need to handle selections better, like there should at least be a getFirstSelected
    for (const key of selectedKeys) {
      const layer = this.props.model.getLayer(key);
      if (layer && layer.type === 'StorySegmentLayer') {
        layerId = key;
        break;
      }
    }

    uiSchema['extent'] = {
      'ui:field': (props: FieldProps) =>
        React.createElement(StorySegmentReset, {
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

    uiSchema['symbologyOverride'] = {
      ...uiSchema['symbologyOverride'],
      items: {
        'ui:title': '',
        targetLayer: {
          'ui:field': 'layerSelect',
        },
        opacity: {
          'ui:field': 'opacity',
        },
      },
      'ui:options': {
        orderable: false,
      },
      'ui:ArrayFieldTemplate': ArrayFieldTemplate,
    };

    // Remove properties that should not be displayed in the form
    const symbologyOverrideItems =
      schema.properties?.symbologyOverride?.items?.properties;
    if (symbologyOverrideItems) {
      delete symbologyOverrideItems.color;
      delete symbologyOverrideItems.symbologyState;
    }

    this.removeFormEntry('zoom', data, schema, uiSchema);
  }
}
