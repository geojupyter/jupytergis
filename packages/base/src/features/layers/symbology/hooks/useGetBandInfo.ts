import { IJGISLayer, IJupyterGISModel } from '@jupytergis/schema';
import { fromArrayBuffer, fromUrl, fromBlob } from 'geotiff';
import { useEffect, useState } from 'react';

import { openEOTileUrl } from '@/src/features/layers/openeo/OpenEOTileLayer';
import { maybeProxied } from '@/src/shared/proxy';
import { loadFile } from '@/src/tools';
import { getBandInfoFromZarr } from '../zarrBandDiscovery';

export interface IBandRow {
  band: number;
  name: string;
  colorInterpretation?: string;
  stats: {
    minimum: number;
    maximum: number;
  };
}

const useGetBandInfo = (
  model: IJupyterGISModel,
  layer: IJGISLayer | null | undefined,
) => {
  const [bandRows, setBandRows] = useState<IBandRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBandInfo = async () => {
    setLoading(true);
    setError(null);

    try {
      const source = model.getSource(layer?.parameters?.source);

      if (layer?.type === 'GeoZarrLayer') {
        try {
          const zarrUrl =
            source?.parameters?.url || source?.parameters?.urls?.[0]?.url;

          if (!zarrUrl) {
            throw new Error('No Zarr URL found.');
          }

          const bands = await getBandInfoFromZarr(zarrUrl);

          const bandsArr: IBandRow[] = bands.map(b => ({
            band: b.band,
            name: b.name,
            colorInterpretation: b.colorInterpretation,
            stats: {
              minimum: b.stats.minimum,
              maximum: b.stats.maximum,
            },
          }));

          setBandRows(bandsArr);
        } catch (err: any) {
          console.error('Zarr band fetch failed:', err);
          setError(`Zarr error: ${err.message}`);
        } finally {
          setLoading(false);
        }

        return;
      }

      let tiff;

      if (layer?.type === 'OpenEOTileLayer') {
        const tileServiceURL = source?.parameters?.tileServiceURL;

        if (!tileServiceURL) {
          setError('No OpenEO tile service URL found.');
          return;
        }

        const { longitude = 0, latitude = 0, zoom = 0 } = model.getOptions();
        const z = Math.max(0, Math.round(zoom));
        const n = 2 ** z;
        const latRad = (latitude * Math.PI) / 180;
        const x = Math.floor(((longitude + 180) / 360) * n);
        const y = Math.floor(
          ((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n,
        );

        const res = await fetch(openEOTileUrl(tileServiceURL, z, x, y));

        if (!res.ok) {
          throw new Error(`HTTP ${res.status} from OpenEO tile service`);
        }

        if (!res.headers.get('Content-Type')?.includes('tiff')) {
          setBandRows(
            [1, 2, 3, 4].map(band => ({
              band,
              name: `Band ${band}`,
              stats: { minimum: 0, maximum: 1 },
            })),
          );
          return;
        }

        tiff = await fromArrayBuffer(await res.arrayBuffer());
      } else {
        const sourceInfo = source?.parameters?.urls[0];

        if (!sourceInfo?.url) {
          setError('No source URL found.');
          setLoading(false);
          return;
        }

        const isRemote =
          sourceInfo.url.startsWith('http://') ||
          sourceInfo.url.startsWith('https://');

        if (isRemote) {
          const url = await maybeProxied(
            sourceInfo.url,
            model,
            source?.parameters?.httpHeaders,
          );

          tiff = await fromUrl(url);
        } else {
          // Handle local GeoTIFF file
          const preloadedFile = await loadFile({
            filepath: sourceInfo.url,
            type: 'GeoTiffSource',
            model,
          });

          if (!preloadedFile.file) {
            setError('Failed to load local file.');
            setLoading(false);
            return;
          }

          tiff = await fromBlob(preloadedFile.file);
        }
      }

      const imageCount = await tiff.getImageCount();
      const image =
        imageCount > 1
          ? await tiff.getImage(imageCount - 1)
          : await tiff.getImage();

      const numberOfBands = image.getSamplesPerPixel();

      const bandsArr: IBandRow[] = [];

      for (let i = 0; i < numberOfBands; i++) {
        // Get min/max from metadata
        const metadata = image.getGDALMetadata?.();

        let min = Infinity;
        let max = -Infinity;

        if (metadata) {
          const m1 = parseFloat(metadata['STATISTICS_MINIMUM']);
          const m2 = parseFloat(metadata['STATISTICS_MAXIMUM']);

          if (!isNaN(m1) && !isNaN(m2)) {
            min = m1;
            max = m2;
          }
        }

        // fallback to sampling
        if (min === Infinity || max === -Infinity) {
          try {
            const raster = await image.readRasters({
              samples: [i],
              width: 64,
              height: 64,
              resampleMethod: 'nearest',
            });

            if (!Array.isArray(raster)) {
              throw new Error('Expected raster to be an array of TypedArrays');
            }

            const bandData = raster[0];

            min = Infinity;
            max = -Infinity;

            for (let j = 0; j < bandData.length; j++) {
              const val = bandData[j];
              if (val < min) {
                min = val;
              }
              if (val > max) {
                max = val;
              }
            }
          } catch (err) {
            console.warn(
              `Could not calculate statistics for band ${i + 1}. Fallback to default min/max.`,
              err,
            );
          }
        }

        // fallback
        if (min === Infinity || max === -Infinity) {
          min = 0;
          max = 100;
        }

        bandsArr.push({
          band: i + 1,
          name: `Band ${i + 1}`,
          stats: {
            minimum: min,
            maximum: max,
          },
        });
      }

      setBandRows(bandsArr);
    } catch (err: any) {
      setError(`Error fetching band info: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBandInfo();
  }, []);

  return { bandRows, setBandRows, loading, error };
};

export default useGetBandInfo;
