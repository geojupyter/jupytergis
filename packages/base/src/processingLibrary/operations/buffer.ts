import { geoProcessingOperationRegistry } from "../registry";

geoProcessingOperationRegistry.add(
    "buffer",
    {
        id: "buffer",
        name: "Buffer vector layer",
        description: "Create boundary polygons a specific distance away from the boundaries of input features",
        arguments: {
            selectedLayer: "VectorLayer",
            distance: "number",
        },
        template: ({ jgisPath, selectedLayer, distance }) => `
import geopandas as gpd
from jupytergis import GISDocument
doc = GISDocument("${jgisPath}")

gdf = gpd.read_file("${selectedLayer}")
gdf = gdf.to_crs(epsg=3857)
gdf["geometry"] = gdf.geometry.buffer(${distance})
gdf = gdf.to_crs(epsg=4326)

gdf.to_file("${selectedLayer}_buffered.geojson", driver="GeoJSON")
doc.add_geojson_layer("${selectedLayer}_buffered.geojson")
print("buffered ${distance} meters")`,
    }
);