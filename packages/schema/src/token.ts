import { Token } from '@lumino/coreutils';

import {
  IJCadWorkerRegistry,
  IJupyterCadTracker,
  IAnnotationModel,
  IJCadFormSchemaRegistry,
  IJCadExternalCommandRegistry
} from './interfaces';

export const IJupyterCadDocTracker = new Token<IJupyterCadTracker>(
  'jupyterCadDocTracker'
);

export const IAnnotationToken = new Token<IAnnotationModel>(
  'jupytercadAnnotationModel'
);

export const IJCadWorkerRegistryToken = new Token<IJCadWorkerRegistry>(
  'jupytercadWorkerRegistry'
);

export const IJCadFormSchemaRegistryToken = new Token<IJCadFormSchemaRegistry>(
  'jupytercadFormSchemaRegistry'
);

export const IJCadExternalCommandRegistryToken =
  new Token<IJCadExternalCommandRegistry>('jupytercadExternalCommandRegistry');
