const CopyPlugin = require('copy-webpack-plugin');
const path = require('path');

const wasmPath = [
    __dirname,
    '../',
    '../',
    'node_modules',
    'gdal3.js',
    'dist',
    'package',
    'gdal3WebAssembly.wasm'
];

const dataPath = [
    __dirname,
    '../',
    '../',
    'node_modules',
    'gdal3.js',
    'dist',
    'package',
    'gdal3WebAssembly.data'
  ];

const staticWasm = [
    __dirname,
    'jupytergis_core',
    'labextension',
    'static',
    '[name].wasm'
];

const staticData = [
    __dirname,
    'jupytergis_core',
    'labextension',
    'static',
    '[name].data'
];

module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: path.join(...wasmPath), to: path.join(...staticWasm) },
        { from: path.join(...dataPath), to: path.join(...staticData) },

      ]
    })
  ]
};
