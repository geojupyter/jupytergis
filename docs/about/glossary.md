# Glossary

## Map elements

```{glossary}

Layer
   The main elements of a map are "layers". Layers can be imagined like a an ordered
   stack of transparencies. Each layer typically represents a single file or web service
   that provides map data. Layers can provide {term}`raster` or {term}`vector` data.

Raster
   A data {term}`Layer` composed of a regular grid of pixels. Conceptually, this is
   similar to an "image", but the data is often represented in measurement values, not
   color values.

Vector
   A data {term}`Layer` consisting of points, lines, and/or polygons.

Feature
   In a vector layer, a single point, line, or polygon element. For example, a single
   earthquake (point), a migration path of an animal (line), or a protected conservation
   area(polygon).

Attribute
   Additional data or measurement about a {term}`Feature` in a vector layer or grid cell
   in a {term}`raster` {term}`Layer`.

   For example, the temperature measured at a grid cell, earthquake magnitude on a point
   feature, the species of an animal on a line feature, or the area in square kilometers
   of a protected conservation area on a polygon feature.
```

## Symbology

```{glossary}

Symbology
   How data is encoded {term}`visually encoded <visual encoding>` on the map.

Symbology Rule
   A set of {term}`Symbolizers <symbolizer>` that define a single representation of a data layer.
   Symbology rules are ordered; a higher rule will appear "above" a lower rule when
   rendered. A Rule can have a pre-processor, for example Kernel Density Estimation
   (KDE), which is applied before its Symbolizers.

Symbolizer
   A triple of data input, interpolation, and {term}`visual encoding`. A {term}`Rule
   <symbology rule>` is composted of many Symbolizers.

Visual encoding
   A method of representing a data {term}`attribute` visually. Encoding methods include
   position on a scale, length, direction, angle, area, volume, curvature, shading, and
   color ({footcite:t}`1984:cleveland-mcgill`, figure 1).

Color map
   A gradient or set of colors used to {term}`visually encode} data with color on the
   map. Sometimes referred to as a "color ramp" or "color scale".

   **Important**: Color is a fraught {term}`visual encoding` method. Is your colormap
   [perceptually uniform](https://chrisholdgraf.com/blog/2018/makeitpop)? Is it usable
   by people with color vision deficiencies? How does it interact with the other
   elements on the map (for example, does your basemap include colors that interact
   poorly with your chosen color map for any form of human color vision)?

Continuous color map
   TODO

Divergent color map
   TODO

Cyclic color map
   TODO

Discrete color map
   TODO. Sometimes refered to as a "categorical" color map or "color palette".
```

## References

```{footbibliography}

```
