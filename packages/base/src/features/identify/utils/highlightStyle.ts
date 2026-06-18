import { Circle, Fill, Stroke, Style } from 'ol/style';
import CircleStyle from 'ol/style/Circle';

/**
 * Build a highlight style from an original resolved style.
 * Preserves data-driven properties (circle radius, line width) and swaps in
 * a constant yellow highlight color.
 */
export function buildHighlightStyle(original: Style, geomType?: string): Style {
  // Only use the circle branch for point geometries.  The OL default style
  // includes a circle image alongside fill/stroke; without this guard the
  // circle branch would fire for polygons and produce an invisible style.
  const isPoint = geomType === 'Point' || geomType === 'MultiPoint';
  if (isPoint) {
    const image = original.getImage();
    if (image instanceof CircleStyle) {
      return new Style({
        image: new Circle({
          radius: image.getRadius() + 4,
          fill: new Fill({ color: 'transparent' }),
          stroke: new Stroke({ color: '#ff0', width: 3 }),
        }),
      });
    }
  }

  const origStroke = original.getStroke();
  const origFill = original.getFill();

  if (origStroke || origFill) {
    return new Style({
      stroke: new Stroke({
        color: 'rgba(255, 255, 0, 0.4)',
        width: (origStroke?.getWidth() ?? 1) + 4,
      }),
      ...(origFill
        ? { fill: new Fill({ color: 'rgba(255, 255, 0, 0.15)' }) }
        : {}),
    });
  }

  // Fallback
  return new Style({
    stroke: new Stroke({ color: 'rgba(255, 255, 0, 0.4)', width: 4 }),
  });
}
