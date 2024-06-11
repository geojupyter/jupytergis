import jcadPlugin from './jgisplugin/plugins';
import stepPlugin from './stepplugin/plugins';
import stlPlugin from './stlplugin/plugins';
import {
  annotationPlugin,
  externalCommandRegistryPlugin,
  formSchemaRegistryPlugin,
  trackerPlugin,
  workerRegistryPlugin
} from './plugin';

export * from './factory';
export default [
  trackerPlugin,
  annotationPlugin,
  workerRegistryPlugin,
  jcadPlugin,
  stepPlugin,
  stlPlugin,
  formSchemaRegistryPlugin,
  externalCommandRegistryPlugin
];
