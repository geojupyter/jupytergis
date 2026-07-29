// Custom Webpack config to make @ngageoint/geopackage run in the browser:
// - Stub out fs, path, util
// - Polyfill stream and Buffer APIs
// - Auto-provide `process` and `Buffer` globals
// - Emit .wasm files as separate assets so `import wasmURL` yields the correct URL

const webpack = require('webpack');
const { VueLoaderPlugin } = require('vue-loader');

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
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer']
    }),
    new VueLoaderPlugin()
  ]
};
