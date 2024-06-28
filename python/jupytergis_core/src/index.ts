import jgisPlugin from './jgisplugin/plugins';
import {
  externalCommandRegistryPlugin,
  formSchemaRegistryPlugin,
  layerBrowserRegistryPlugin,
  trackerPlugin
} from './plugin';

export * from './factory';
export default [
  trackerPlugin,
  jgisPlugin,
  formSchemaRegistryPlugin,
  externalCommandRegistryPlugin,
  layerBrowserRegistryPlugin
];
