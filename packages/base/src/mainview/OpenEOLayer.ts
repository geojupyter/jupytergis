import { showErrorMessage } from '@jupyterlab/apputils';
import { OpenEO, Process } from '@openeo/js-client';
import TileLayer from 'ol/layer/Tile';
import { ProjectionLike } from 'ol/proj';
import { XYZ as XYZSource } from 'ol/source';
import { Options as XYZOptions } from 'ol/source/XYZ';

// import { PromiseDelegate } from '@lumino/coreutils';

export async function connect(
  connectionInfo: IOpenEOConnectionInfo,
  processGraph: Process,
): Promise<string> {
  let { url, username, password } = connectionInfo;

  if (!url.match(/^https?:\/\//i)) {
    url = `https://${url}`;
  }

  const errorTitle = 'Failed to connect to the OpenEO server';

  const parsedUrl = new URL(url);
  if (
    window.location.protocol === 'https:' &&
    parsedUrl.protocol !== 'https:'
  ) {
    showErrorMessage(
      errorTitle,
      'You are trying to connect to a server with HTTP instead of HTTPS, which is insecure and prohibited by web browsers. Please use HTTPS instead.',
    );
    throw new Error(errorTitle);
  }

  try {
    const connection = await OpenEO.connect(url, {
      addNamespaceToProcess: true,
    });
    console.log('connection', connection);

    const providers = await connection.listAuthProviders();
    console.log('authproviders', providers);

    // TODO Support other providers: oidc etc.
    const basicProvider = providers.find(provider => provider.type === 'basic');
    if (!basicProvider) {
      throw new Error('Only OpenEO basic provider supported for now.');
    }

    await basicProvider.login(username, password);

    const serviceTypes = await connection.listServiceTypes();

    // TODO Support other services?
    if (!serviceTypes['XYZ']) {
      throw new Error('We need the OpenEO service to support XYZ tiling.');
    }

    const service = await connection.createService(processGraph, 'XYZ');

    if (!service.url) {
      throw new Error('Failed to connect to XYZ service');
    }

    console.log('service', service);

    return service.url;
  } catch (error) {
    showErrorMessage(errorTitle, `${error}`);

    throw error;
  }

  // this.loading = true;
  // try {
  //   if (await this.connect(serverUrl)) {
  //     this.addServer(serverUrl);
  //     if (!programmatically) {
  //       window.history.pushState({reset: true, serverUrl: this.serverUrl, autoConnect: true, skipLogin}, "", this.makeUrl());
  //     }
  //     if (skipLogin) {
  //       await this.initDiscovery();
  //     }
  //     else if (await this.tryResumeSession()) {
  //       await this.initDiscovery();
  //     }
  //   }
  //   else {
  //     Utils.exception(this, this.connectionError);
  //   }
  // } catch (error) {
  //   Utils.exception(this, error);
  // }

  // this.loading = false;
  // if (!this.isConnected && this.allowOtherServers) {
  //   this.autoConnect = false;
  // }
}

// function tileToBBox(z: number, x: number, y: number) {
//   const n = Math.pow(2, z);

//   const lonMin = (x / n) * 360 - 180;
//   const lonMax = ((x + 1) / n) * 360 - 180;

//   const latMin = tile2lat(y + 1, z);
//   const latMax = tile2lat(y, z);

//   return [lonMin, latMin, lonMax, latMax];
// }

// function tile2lat(y: number, z: number) {
//   const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
//   return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
// }

export interface IOpenEOConnectionInfo {
  /**
   * The url to the open-eo server.
   */
  url: string;

  /**
   * The authentication username.
   */
  username: string;

  /**
   * The authentication password.
   */
  password: string;
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

export type IOpenEOSourceOptions = XYZOptions

export class OpenEOSource extends XYZSource {
  constructor(options: IOpenEOSourceOptions) {
    super({
      ...options,
      url: '{z},{x},{y}',
      tileLoadFunction: (tile: any, src) => {
        let url = options.url;

        if (!url) {
          throw new Error('XYZ URL undefined');
        }

        const [z, x, y] = tile.tileCoord;

        url = url.replace('%7Bz%7D', z);
        url = url.replace('%7By%7D', y);
        url = url.replace('%7Bx%7D', x);

        // const body = this.buildOpenEORequest(z, x, y, processGraph);
        // const headers: any = {
        //   'Content-Type': 'application/json',
        // }
        // if (connectionInfo.token) {
        //   headers['Authorization'] = `Bearer ${connectionInfo.token}`
        // }

        // TODO Use await
        fetch(url, {
          method: 'GET',
        })
          .then(res => res.blob())
          .then(blob => {
            tile.getImage().src = URL.createObjectURL(blob);
          });
      },
    });
  }

  // private buildOpenEORequest(
  //   z: number,
  //   x: number,
  //   y: number,
  //   processGraph: TProcessGraph
  // ) {
  //   const bbox = tileToBBox(z, x, y);

  //   return {
  //     process: {
  //       process_graph: processGraph
  //     },

  //     // Dynamically derived from tile
  //     spatial_extent: {
  //       west: bbox[0],
  //       south: bbox[1],
  //       east: bbox[2],
  //       north: bbox[3],
  //       crs: "EPSG:4326"
  //     },

  //     // Optional but usually needed
  //     output: {
  //       format: "PNG"
  //     }
  //   };
  // }

  // private _tileurl: PromiseDelegate<string>;

  // processGraph: TProcessGraph;

  // connectionInfo: IOpenEOConnectionInfo;
}
