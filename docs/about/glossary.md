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
   How data is {term}`visually encoded <visual encoding>` on the map.

Symbology Rule
   A set of {term}`Symbolizers <symbolizer>` that define a single representation of a data layer.
   Symbology rules are ordered; a higher rule will appear "above" a lower rule when
   rendered. A Rule can have a pre-processor, for example Kernel Density Estimation
   (KDE), which is applied before its Symbolizers.

Symbolizer
   A triple of data input, interpolation, and {term}`visual encoding`. A {term}`Rule
   <symbology rule>` is composed of many Symbolizers.

Visual encoding
   How data {term}`attributes <attribute>` are matched to visual characteristics like
   shape, color, or position ({footcite:t}`1984:cleveland-mcgill`, figure 1).

Color map
   A gradient or set of colors used to {term}`visually encode <visual encoding>` data
   with color on the map.

   Sometimes referred to as a "color ramp" or "color scale".

   **Important**: Color is a fraught {term}`visual encoding` method. Is your colormap
   [perceptually uniform](https://chrisholdgraf.com/blog/2018/makeitpop)? Is it usable
   by people with color vision deficiencies? How does it interact with the other
   elements on the map (for example, does your basemap include colors that interact
   poorly with your chosen color map for any form of human color vision)? Also see
   [understanding docs for WCAG SC 1.4.1 "Use of Color"](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html).

Sequential color map
   A colormap which progresses between two colors. A sequential colormap is useful for
   representing an ordered scalar value like temperature or magnitude.

Divergent color map
   A colormap which diverges from a central value to extremes at each end. For example,
   a white center, dark red on one end, and dark blue on the other end. A divergent
   colormap is useful for representing scalar values that diverge from a critical value
   such as gain or loss (divergence from 0), or anomaly (divergence from average).

Cyclic color map
   A colormap which ends where it starts. A cyclic colormap is useful for representing
   cyclic values like phase or angle.

Categorical color map
   A colormap with a small set of discrete colors, without transitions between them. A
   categorical colormap is useful for representing categorical data, like land surface
   classification.

   Sometimes refered to as a "discrete" or "qualitative" color map, or a "color
   palette".
```

## Data properties

```{glossary}

Coordinate Reference System
   The system that gives the numbers in a dataset a meaning as positions on the Earth.
   It says where the origin is, which direction the axes run, what units the
   coordinates are in, and what shape the Earth is assumed to be.

   Two datasets can describe the same place with completely different numbers if they
   use different coordinate reference systems, which is why JupyterGIS has to know
   which one a {term}`Layer` uses before it can draw it in the right place.

   Coordinate reference systems are usually identified by an EPSG code such as
   `EPSG:4326` (longitude/latitude on the WGS 84 globe) or `EPSG:3857` (the projected
   system used by most web maps). [epsg.io](https://epsg.io) has a page for each code.

   Often abbreviated "CRS", and often used interchangeably with
   {term}`projection`, though strictly a projection is only one part of it.

Projection
   The recipe for flattening the curved surface of the Earth onto a flat map. Every
   projection distorts something — area, shape, distance or direction — so the right
   choice depends on what the map is for.

   See [the QGIS documentation on coordinate reference
   systems](https://docs.qgis.org/latest/en/docs/gentle_gis_introduction/coordinate_reference_systems.html)
   for an illustrated introduction.

Extent
   The bounding box a dataset covers, given as its minimum and maximum coordinates on
   each axis. An extent is only meaningful alongside the {term}`Coordinate Reference
   System` its numbers are expressed in.

Band
   One measurement grid within a {term}`raster` {term}`Layer`. A photograph-like raster
   has red, green and blue bands; a satellite image may have many more, including
   wavelengths the eye cannot see. Each band has its own range of values.

No data value
   The value a {term}`raster` uses to mark cells where there is no measurement, so that
   they can be left transparent instead of being drawn as if they were real data.

Tile pyramid
   A set of progressively lower-resolution copies of a dataset, stored alongside the
   full-resolution one so that a zoomed-out view can be drawn without reading every
   pixel.

   In a raster file the copies are called "overviews"; a
   [Cloud-Optimized GeoTIFF](https://cogeo.org) is essentially a GeoTIFF that stores
   them in a layout that can be read efficiently over a network. Tiled web services
   have the same idea expressed as a range of zoom levels.
```

## References

```{footbibliography}

```
