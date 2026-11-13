import { IGrammarSymbologyState, RGBA } from '@jupytergis/schema';
import { UUID } from '@lumino/coreutils';
import { GeoTIFFImage } from 'geotiff';

export function paletteSymbology(
  image: GeoTIFFImage,
): IGrammarSymbologyState | undefined {
  const colorMap = image.getFileDirectory().ColorMap;
  if (!colorMap) {
    return undefined;
  }

  const noData = image.getGDALNoData();
  const size = colorMap.length / 3;
  const colors: RGBA[] = [];
  for (let i = 0; i < size; i++) {
    colors.push([
      Math.round(colorMap[i] / 257),
      Math.round(colorMap[size + i] / 257),
      Math.round(colorMap[2 * size + i] / 257),
      i === noData ? 0 : 1,
    ]);
  }

  // Unused entries share one colour: use it as the fallback and leave it out
  // of the stops, so that only the real classes are listed.
  const counts: Record<string, number> = {};
  colors.forEach(c => (counts[c.join()] = (counts[c.join()] ?? 0) + 1));
  const fallback = colors.reduce((a, b) =>
    counts[b.join()] > counts[a.join()] ? b : a,
  );

  return {
    layers: [
      {
        id: UUID.uuid4(),
        rules: [
          {
            id: UUID.uuid4(),
            fields: ['band_1'],
            mappings: [
              {
                scale: {
                  scheme: 'categorical',
                  params: {
                    colorRamp: 'schemeCategory10',
                    fallback,
                    colorStops: colors
                      .map((color, stop) => ({ stop, color }))
                      .filter(({ color }) => color.join() !== fallback.join()),
                  },
                },
                encodings: ['pixel-color'],
              },
            ],
          },
        ],
      },
    ],
  };
}
