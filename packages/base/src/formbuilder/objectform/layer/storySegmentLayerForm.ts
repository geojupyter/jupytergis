import { IDict, IStorySegmentLayer } from '@jupytergis/schema';
import { FieldProps } from '@rjsf/core';
import * as React from 'react';

import { SourcePropertiesField } from '../components/SourcePropertiesField';
import { ArrayFieldTemplate } from '../components/SegmentFormSymbology';
import { LayerPropertiesForm } from './layerform';
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

    uiSchema['layerOverride'] = {
      ...uiSchema['layerOverride'],
      items: {
        'ui:title': '',
        targetLayer: {
          'ui:field': 'layerSelect',
        },
        opacity: {
          'ui:field': 'opacity',
        },
        sourceProperties: {
          'ui:field': SourcePropertiesField,
        },
      },
      'ui:options': {
        orderable: false,
      },
      'ui:ArrayFieldTemplate': ArrayFieldTemplate,
    };

    // Remove properties that should not be displayed in the form
    const layerOverrideItems =
      schema.properties?.layerOverride?.items?.properties;
    if (layerOverrideItems) {
      delete layerOverrideItems.color;
      delete layerOverrideItems.symbologyState;
    }

    this.removeFormEntry('zoom', data, schema, uiSchema);
  }
}
