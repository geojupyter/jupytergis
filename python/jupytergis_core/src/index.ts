import jgisPlugin from './jgisplugin/plugins';
import {
  externalCommandRegistryPlugin,
  formSchemaRegistryPlugin,
  layerBrowserRegistryPlugin,
  trackerPlugin,
  annotationPlugin,
} from './plugin';
import tourPlugin from './tour';

export * from './factory';
export default [
  trackerPlugin,
  jgisPlugin,
  formSchemaRegistryPlugin,
  externalCommandRegistryPlugin,
  layerBrowserRegistryPlugin,
  annotationPlugin,
  tourPlugin,
];
