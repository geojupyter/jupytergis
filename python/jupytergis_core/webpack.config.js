// Custom Webpack config to make @ngageoint/geopackage run in the browser:
// - Stub out fs, path, util
// - Polyfill stream and Buffer APIs
// - Auto-provide `process` and `Buffer` globals
// - Emit .wasm files as separate assets so `import wasmURL` yields the correct URL

const webpack = require('webpack');

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
      }
    ]
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer']
    })
  ]
};
