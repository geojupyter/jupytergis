import jgisPlugin from './jgisplugin/plugins';
import {
  externalCommandRegistryPlugin,
  formSchemaRegistryPlugin,
  layerBrowserRegistryPlugin,
  trackerPlugin,
  annotationPlugin
} from './plugin';

export * from './factory';
export default [
  trackerPlugin,
  jgisPlugin,
  formSchemaRegistryPlugin,
  externalCommandRegistryPlugin,
  layerBrowserRegistryPlugin,
  annotationPlugin
];
