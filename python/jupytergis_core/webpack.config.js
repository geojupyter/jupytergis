// Custom Webpack config to make @ngageoint/geopackage run in the browser:
// - Stub out fs, path, util
// - Polyfill stream and Buffer APIs
// - Auto-provide `process` and `Buffer` globals
// - Emit .wasm files as separate assets so `import wasmURL` yields the correct URL

// @jupyter/builder bundles labextensions with rspack, so the ProvidePlugin
// must come from @rspack/core rather than webpack (the webpack instance is
// incompatible with the rspack compiler this config is merged into).
const rspack = require('@rspack/core');
const { VueLoaderPlugin } = require('vue-loader');

// In development mode @jupyter/builder injects an rspack-native source-map rule
// (`{ test: /\.js$/, enforce: 'pre', extractSourceMap: true }`) that has no
// `use`. vue-loader 15's VueLoaderPlugin clones every non-Vue rule through
// webpack's own RuleSetCompiler, which doesn't understand rspack's `enforce`
// (without `use`) or `extractSourceMap` and throws
// "Properties enforce, extractSourceMap are unknown". Pull any such rspack-only
// rule out of the rule list before VueLoaderPlugin runs, then restore it once
// VueLoaderPlugin has rebuilt the list, so source-map extraction still happens.
class HideRspackNativeRulesFromVueLoader {
  apply(compiler) {
    const isRspackNative = rule => rule && rule.extractSourceMap;
    const hidden = compiler.options.module.rules.filter(isRspackNative);
    if (!hidden.length) {
      return;
    }
    compiler.options.module.rules = compiler.options.module.rules.filter(
      rule => !isRspackNative(rule)
    );
    compiler.hooks.afterPlugins.tap('HideRspackNativeRulesFromVueLoader', () => {
      compiler.options.module.rules.push(...hidden);
    });
  }
}

module.exports = {
  resolve: {
    fallback: {
      fs: false,
      path: false,
      util: false,
      stream: require.resolve('stream-browserify'),
      buffer: require.resolve('buffer/'),
    }
  },
  module: {
    parser: {
      javascript: {
        // geoparquet's barrel re-exports `asyncBufferFromFile` from hyparquet,
        // which only exists in hyparquet's Node entry — not the browser export
        // condition rspack resolves. base never uses it, so downgrade rspack's
        // strict ESM "export not found" check from error to warning (webpack's
        // old, lenient behavior) instead of failing the browser bundle.
        exportsPresence: 'warn'
      }
    },
    rules: [
      {
        test: /\.wasm$/,
        type: 'asset/resource'
      },
      {
        test: /\.vue$/,
        loader: 'vue-loader',
        options: { shadowMode: true }
      },
      {
        test: /\.s[ac]ss$/,
        resourceQuery: /vue/,
        use: [
          { loader: 'vue-style-loader', options: { shadowMode: true } },
          { loader: 'css-loader', options: { esModule: false } },
          {
            loader: 'sass-loader',
            options: {
              sassOptions: { silenceDeprecations: ['legacy-js-api'] }
            }
          }
        ]
      },
      // Plain CSS pulled in from SFCs via `<style src="…">` (e.g.
      // vue-multiselect's stylesheet). Same `?vue`-scoped shadow injection
      // as the SCSS blocks so dropdowns etc. are styled inside the shadow
      // root rather than leaking to document.head. vue-loader's pitcher
      // re-emits these with inline loaders, so JupyterLab's own .css rule
      // doesn't double-process them.
      {
        test: /\.css$/,
        resourceQuery: /vue/,
        use: [
          { loader: 'vue-style-loader', options: { shadowMode: true } },
          { loader: 'css-loader', options: { esModule: false } }
        ]
      }
    ]
  },
  plugins: [
    new rspack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer']
    }),
    new HideRspackNativeRulesFromVueLoader(),
    new VueLoaderPlugin()
  ]
};
