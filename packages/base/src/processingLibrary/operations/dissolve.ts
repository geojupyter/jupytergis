import { geoProcessingOperationRegistry } from "../registry";

geoProcessingOperationRegistry.add(
    "dissolve",
    {
        id: "dissolve",
        name: "Dissolve vector layer",
        description: "Merge all features of a vector layer into a single feature",
        arguments: {
            selectedLayer: "VectorLayer",
            multipart: "boolean",
        },
        template: ({ jgisPath, selectedLayer, multipart }) => `
import geopandas as gpd
from jupytergis import GISDocument
doc = GISDocument("${jgisPath}")

gdf = gpd.read_file("${selectedLayer}")
gdf = gdf.dissolve()
${multipart ? "gdf = gdf.explode(index_parts=False)" : ""}

gdf.to_file("${selectedLayer}_dissolved.geojson", driver="GeoJSON")
doc.add_geojson_layer("${selectedLayer}_dissolved.geojson")
print("dissolved layer")`,
    }
);