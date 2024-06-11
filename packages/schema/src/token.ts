import { Token } from '@lumino/coreutils';

import {
  IJupyterGISTracker,
  IJGISFormSchemaRegistry,
  IJGISExternalCommandRegistry
} from './interfaces';

export const IJupyterGISDocTracker = new Token<IJupyterGISTracker>(
  'jupyterCadDocTracker'
);

export const IJGISFormSchemaRegistryToken = new Token<IJGISFormSchemaRegistry>(
  'jupytergisFormSchemaRegistry'
);

export const IJGISExternalCommandRegistryToken =
  new Token<IJGISExternalCommandRegistry>('jupytergisExternalCommandRegistry');
