import jgisPlugin from './jgisplugin/plugins';
import {
  externalCommandRegistryPlugin,
  formSchemaRegistryPlugin,
  trackerPlugin,
} from './plugin';

export * from './factory';
export default [
  trackerPlugin,
  jgisPlugin,
  formSchemaRegistryPlugin,
  externalCommandRegistryPlugin,
];
