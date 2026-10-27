export const TRUE_COLOR_GRAPH: Record<string, any> = {
  loadcollection1: {
    arguments: {
      id: 'sentinel-2-global-mosaics',
      bands: ['B04', 'B03', 'B02'],
      properties: {},
      spatial_extent: { west: -74, south: 40.7, east: -73.9, north: 40.8 },
      temporal_extent: ['2022-04-15', '2022-12-31'],
    },
    process_id: 'load_collection',
  },
  reducedimension1: {
    arguments: {
      data: { from_node: 'loadcollection1' },
      dimension: 'time',
      reducer: {
        process_graph: {
          first1: {
            arguments: { data: { from_parameter: 'data' } },
            process_id: 'first',
            result: true,
          },
        },
      },
    },
    process_id: 'reduce_dimension',
  },
  apply1: {
    arguments: {
      data: { from_node: 'reducedimension1' },
      process: {
        process_graph: {
          linearscalerange1: {
            arguments: {
              inputMax: 10000,
              inputMin: 0,
              outputMax: 255,
              x: { from_parameter: 'x' },
            },
            process_id: 'linear_scale_range',
          },
          trunc1: {
            arguments: { x: { from_node: 'linearscalerange1' } },
            process_id: 'trunc',
            result: true,
          },
        },
      },
    },
    process_id: 'apply',
  },
  colorformula1: {
    arguments: {
      data: { from_node: 'apply1' },
      formula: 'Gamma RGB 1.5 Sigmoidal RGB 6 0.3 Saturation 1',
    },
    process_id: 'color_formula',
  },
  saveresult1: {
    arguments: {
      data: { from_node: 'colorformula1' },
      format: 'PNG',
      options: {},
    },
    process_id: 'save_result',
    result: true,
  },
};

export const NDVI_GRAPH: Record<string, any> = {
  loadcollection1: {
    arguments: {
      id: 'sentinel-2-global-mosaics',
      bands: ['B08', 'B04'],
      properties: {},
      spatial_extent: { west: -74, south: 40.7, east: -73.9, north: 40.8 },
      temporal_extent: ['2022-04-15', '2022-12-31'],
    },
    process_id: 'load_collection',
  },
  reducedimension1: {
    arguments: {
      data: { from_node: 'loadcollection1' },
      dimension: 'time',
      reducer: {
        process_graph: {
          first1: {
            arguments: { data: { from_parameter: 'data' } },
            process_id: 'first',
            result: true,
          },
        },
      },
    },
    process_id: 'reduce_dimension',
  },
  ndvi1: {
    arguments: {
      data: { from_node: 'reducedimension1' },
      dimension: 'bands',
      reducer: {
        process_graph: {
          nir: {
            arguments: { data: { from_parameter: 'data' }, index: 0 },
            process_id: 'array_element',
          },
          red: {
            arguments: { data: { from_parameter: 'data' }, index: 1 },
            process_id: 'array_element',
          },
          diff: {
            arguments: { x: { from_node: 'nir' }, y: { from_node: 'red' } },
            process_id: 'subtract',
          },
          sum: {
            arguments: { x: { from_node: 'nir' }, y: { from_node: 'red' } },
            process_id: 'add',
          },
          ndvi: {
            arguments: { x: { from_node: 'diff' }, y: { from_node: 'sum' } },
            process_id: 'divide',
            result: true,
          },
        },
      },
    },
    process_id: 'reduce_dimension',
  },
  apply1: {
    arguments: {
      data: { from_node: 'ndvi1' },
      process: {
        process_graph: {
          linearscalerange1: {
            arguments: {
              inputMin: -1,
              inputMax: 1,
              outputMin: 0,
              outputMax: 255,
              x: { from_parameter: 'x' },
            },
            process_id: 'linear_scale_range',
          },
          trunc1: {
            arguments: { x: { from_node: 'linearscalerange1' } },
            process_id: 'trunc',
            result: true,
          },
        },
      },
    },
    process_id: 'apply',
  },
  saveresult1: {
    arguments: { data: { from_node: 'apply1' }, format: 'PNG', options: {} },
    process_id: 'save_result',
    result: true,
  },
};
