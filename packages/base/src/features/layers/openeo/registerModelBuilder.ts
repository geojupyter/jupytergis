import ModelBuilder from '@openeo/vue-components/components/ModelBuilder.vue';

// Vue 2.7's type definitions declare a *global* JSX namespace that collides
// with React's JSX across this project, so we pull the Vue runtime in
// untyped via `require` rather than `import … from 'vue'`
/* eslint-disable @typescript-eslint/no-var-requires */
const Vue = require('vue');
const wrapModule = require('@vue/web-component-wrapper');
const wrap = wrapModule.default ?? wrapModule;
// vue-multiselect ships a plain stylesheet rather than an SFC `<style>`
// block, so vue-style-loader's shadow injection never picks it up (and
// JupyterLab's MiniCssExtract drops it). Pull the raw CSS text via an inline
// css-loader request — the leading `!!` bypasses JupyterLab's own `.css`
// rule — and inject it into each element's shadow root in connectedCallback.
const multiselectStyles: string = require(
  '!!css-loader?{"esModule":false}!vue-multiselect/dist/vue-multiselect.min.css',
).toString();
/* eslint-enable @typescript-eslint/no-var-requires */

const ELEMENT_NAME = 'openeo-model-builder';

/**
 * Register the openEO ModelBuilder as the `<openeo-model-builder>` custom
 * element, compiled into this extension's own bundle by webpack (vue-loader
 * + @vue/web-component-wrapper).
 */
export function registerOpenEOModelBuilder(): void {
  if (typeof window === 'undefined' || !window.customElements) {
    return;
  }
  if (window.customElements.get(ELEMENT_NAME)) {
    return;
  }
  const WrappedElement = wrap(Vue, { ...ModelBuilder }) as {
    new (): HTMLElement & { connectedCallback(): void };
  };
  class OpenEOModelBuilder extends WrappedElement {
    connectedCallback(): void {
      super.connectedCallback();
      const root = this.shadowRoot;
      if (root && !root.querySelector('style[data-openeo-multiselect]')) {
        const style = document.createElement('style');
        style.setAttribute('data-openeo-multiselect', '');
        style.textContent = multiselectStyles;
        root.appendChild(style);
      }
    }
  }
  window.customElements.define(ELEMENT_NAME, OpenEOModelBuilder);
}
