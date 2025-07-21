import { Token } from '@lumino/coreutils';

import {
  IAnnotationModel,
  IJGISExternalCommandRegistry,
  IJGISFormSchemaRegistry,
  IJGISLayerBrowserRegistry,
  IJupyterGISTracker,
} from './interfaces';

export const IJupyterGISDocTracker = new Token<IJupyterGISTracker>(
  'jupyterGISDocTracker',
);

export const IJGISFormSchemaRegistryToken = new Token<IJGISFormSchemaRegistry>(
  'jupytergisFormSchemaRegistry',
);

export const IJGISExternalCommandRegistryToken =
  new Token<IJGISExternalCommandRegistry>('jupytergisExternalCommandRegistry');

export const IJGISLayerBrowserRegistryToken =
  new Token<IJGISLayerBrowserRegistry>('jupytergisExternalCommandRegistry');

export const IAnnotationToken = new Token<IAnnotationModel>(
  'jupytergisAnnotationModel',
);
