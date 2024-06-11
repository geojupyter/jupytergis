import { Token } from '@lumino/coreutils';

import {
  IJupyterGISTracker,
  IJGISFormSchemaRegistry,
  IJGISExternalCommandRegistry
} from './interfaces';

export const IJupyterCadDocTracker = new Token<IJupyterGISTracker>(
  'jupyterCadDocTracker'
);

export const IJGISFormSchemaRegistryToken = new Token<IJGISFormSchemaRegistry>(
  'jupytercadFormSchemaRegistry'
);

export const IJGISExternalCommandRegistryToken =
  new Token<IJGISExternalCommandRegistry>('jupytercadExternalCommandRegistry');
