import TileLayer from 'ol/layer/Tile';
import { ProjectionLike } from 'ol/proj';
import {
  default as ImageTileSource,
  Options as ImageTileOptions,
} from 'ol/source/ImageTile';

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

export interface IOpenEOSourceOptions extends ImageTileOptions {
  /**
   * The process graph value.
   */
  processGraph: TProcessGraph;

  /**
   * The connection info.
   */
  connectionInfo: IOpenEOConnectionInfo;
}

export class OpenEOSource extends ImageTileSource {
  constructor(options: IOpenEOSourceOptions) {
    const { processGraph, connectionInfo } = options;

    super({
      ...options,
      url: (z: number, x: number, y: number, options: any) => {
        // TODO Remove or use this
        console.log(options);
        return this.buildOpenEOTileURL(z, x, y, processGraph, connectionInfo);
      },
    });
  }

  private buildOpenEOTileURL(
    z: number,
    x: number,
    y: number,
    processGraph: TProcessGraph,
    connectionInfo: IOpenEOConnectionInfo,
  ) {
    const { url, token } = connectionInfo;

    const bbox = tileToBBox(z, x, y);

    const body = {
      process: {
        process_graph: processGraph,
      },
      spatial_extent: {
        west: bbox[0],
        south: bbox[1],
        east: bbox[2],
        north: bbox[3],
        crs: 'EPSG:4326',
      },
      output: {
        format: 'PNG',
      },
    };

    // Encode POST as URL (simple approach)
    const encoded = encodeURIComponent(JSON.stringify(body));


    return `${url}/result?request=${encoded}${token ? `&token=${token}` : ''}`;
  }

  processGraph: TProcessGraph;

  connectionInfo: IOpenEOConnectionInfo;
}
