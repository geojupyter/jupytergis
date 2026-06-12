import ModelBuilder from '@openeo/vue-components/components/ModelBuilder.vue';

// Vue 2.7's types declare a *global* JSX namespace that collides with React's
// across this project, so pull the Vue runtime + wrapper in untyped via require.
/* eslint-disable @typescript-eslint/no-var-requires */
const Vue = require('vue');
const wrapModule = require('@vue/web-component-wrapper');
const wrap = wrapModule.default ?? wrapModule;
/* eslint-enable @typescript-eslint/no-var-requires */

const ELEMENT_NAME = 'openeo-model-builder';

/**
 * Register the openEO ModelBuilder as the `<openeo-model-builder>` custom
 * element, compiled into this extension's own bundle (vue-loader +
 * @vue/web-component-wrapper).
 */
export function registerOpenEOModelBuilder(): void {
  if (typeof window === 'undefined' || !window.customElements) {
    return;
  }
  if (window.customElements.get(ELEMENT_NAME)) {
    return;
  }

  // Wrap a *clone* of the options: `wrap()` mutates them with hooks that sync an
  // instance's props onto the shared root. ModelBuilder nests itself (callback
  // sub-graphs), and a nested instance would otherwise clobber the root graph.
  window.customElements.define(ELEMENT_NAME, wrap(Vue, { ...ModelBuilder }));
}
