import type { GetResourceResponse, RequestParameters } from 'maplibre-gl';

import { loadOpenEOTile } from '@/src/features/layers/openeo/OpenEOTileLayer';
import type { CogColorFunction } from './cogColorFunction';

const PROTOCOL = 'openeo://';

// OpenLayers reads OpenEO tiles at its default tile size too.
const TILE_SIZE = 256;

const colorFunctions = new Map<string, CogColorFunction>();

/** The MapLibre tiles url of an OpenEO XYZ service url. */
export function openEOTilesUrl(serviceUrl: string): string {
  return (
    PROTOCOL +
    serviceUrl
      .replace('%7Bz%7D', '{z}')
      .replace('%7Bx%7D', '{x}')
      .replace('%7By%7D', '{y}')
  );
}

/** Paints `tilesUrl` tiles with `colorFunction`; none draws them as sent. */
export function setOpenEOColorFunction(
  tilesUrl: string,
  colorFunction?: CogColorFunction,
): void {
  if (colorFunction) {
    colorFunctions.set(tilesUrl, colorFunction);
  } else {
    colorFunctions.delete(tilesUrl);
  }
}

function imageBands(image: ImageBitmap): Float32Array {
  const context = new OffscreenCanvas(TILE_SIZE, TILE_SIZE).getContext('2d')!;
  context.drawImage(image, 0, 0);
  const { data } = context.getImageData(0, 0, TILE_SIZE, TILE_SIZE);
  // OpenLayers reads image bands as 0 to 1.
  return Float32Array.from(data, value => value / 255);
}

function bandsAsColor(pixel: ArrayLike<number>, color: Uint8ClampedArray) {
  const value = (band: number) => Math.min(Math.max(pixel[band], 0), 1) * 255;
  const rgb = pixel.length >= 3;
  color[0] = value(0);
  color[1] = value(rgb ? 1 : 0);
  color[2] = value(rgb ? 2 : 0);
  color[3] = pixel.length === 4 ? value(3) : 255;
}

export async function openEOProtocol(
  params: RequestParameters,
): Promise<GetResourceResponse<ImageBitmap>> {
  const tile = await loadOpenEOTile(params.url.slice(PROTOCOL.length));
  const colorFunction = [...colorFunctions].find(([tilesUrl]) =>
    params.url.startsWith(tilesUrl.split('{z}')[0]),
  )?.[1];

  if (tile instanceof ImageBitmap && !colorFunction) {
    return { data: tile };
  }

  const values = tile instanceof ImageBitmap ? imageBands(tile) : tile;
  const bandCount = values.length / (TILE_SIZE * TILE_SIZE);
  const pixel = new Float32Array(bandCount);
  const color = new Uint8ClampedArray(4);
  const rgba = new Uint8ClampedArray(TILE_SIZE * TILE_SIZE * 4);

  for (let i = 0; i < TILE_SIZE * TILE_SIZE; i++) {
    pixel.set(values.subarray(i * bandCount, (i + 1) * bandCount));
    if (colorFunction) {
      color.fill(0);
      colorFunction(pixel, color, {});
    } else {
      bandsAsColor(pixel, color);
    }
    rgba.set(color, i * 4);
  }

  return {
    data: await createImageBitmap(new ImageData(rgba, TILE_SIZE, TILE_SIZE)),
  };
}
