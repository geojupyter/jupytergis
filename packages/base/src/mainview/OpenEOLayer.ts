import TileLayer from 'ol/layer/Tile';
import { ProjectionLike } from 'ol/proj';
import {
  Options as XYZOptions,
} from 'ol/source/XYZ';
import {
  XYZ as XYZSource
} from 'ol/source';

function tileToBBox(z: number, x: number, y: number) {
  const n = Math.pow(2, z);

  const lonMin = (x / n) * 360 - 180;
  const lonMax = ((x + 1) / n) * 360 - 180;

  const latMin = tile2lat(y + 1, z);
  const latMax = tile2lat(y, z);

  return [lonMin, latMin, lonMax, latMax];
}

function tile2lat(y: number, z: number) {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

// TODO Better typing?
export type TProcessGraph = any;

export interface IOpenEOConnectionInfo {
  /**
   * The url to the open-eo server.
   */
  url: string;

  /**
   * The authentication token.
   */
  token?: string;
}

export interface IOpenEOLayerOptions {
  /**
   * The tile size
   */
  projection?: ProjectionLike;
}

export class OpenEOLayer extends TileLayer {
  // Just an alias
}

export interface IOpenEOSourceOptions extends XYZOptions {
  /**
   * The process graph value.
   */
  processGraph: TProcessGraph;

  /**
   * The connection info.
   */
  connectionInfo: IOpenEOConnectionInfo;
}

export class OpenEOSource extends XYZSource {
  constructor(options: IOpenEOSourceOptions) {
    const { processGraph, connectionInfo } = options;

    super({
      ...options,
      url: '{z},{x},{y}',
      tileLoadFunction: (tile: any, src) => {
        const [z, x, y] = tile.tileCoord;

        const body = this.buildOpenEORequest(z, x, y, processGraph);
        const headers: any = {
          'Content-Type': 'application/json',
        }
        if (connectionInfo.token) {
          headers['Authorization'] = `Bearer ${connectionInfo.token}`
        }

        // TODO Use await
        fetch(connectionInfo.url + '/result', {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        })
          .then(res => res.blob())
          .then(blob => {
            tile.getImage().src = URL.createObjectURL(blob);
          });
      },
    });
  }

  private buildOpenEORequest(
    z: number,
    x: number,
    y: number,
    processGraph: TProcessGraph
  ) {
    const bbox = tileToBBox(z, x, y);

    return {
      process: {
        process_graph: processGraph
      },

      // Dynamically derived from tile
      spatial_extent: {
        west: bbox[0],
        south: bbox[1],
        east: bbox[2],
        north: bbox[3],
        crs: "EPSG:4326"
      },

      // Optional but usually needed
      output: {
        format: "PNG"
      }
    };
  }

  processGraph: TProcessGraph;

  connectionInfo: IOpenEOConnectionInfo;
}
