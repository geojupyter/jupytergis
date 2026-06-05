import { geoProcessingOperationRegistry } from "../registry";

//i think this still doesn't really work yet, need to review to track down bugs

geoProcessingOperationRegistry.add(
    "clip",
    {
        id: "clip",
        name: "Clip",
        description: "Clip a raster or vector layer to with a polygon layer",
        arguments: {
            targetLayer: "NormalLayer",
            clipLayer: "PolygonLayer",
        },
        template: ({ jgisPath, targetLayer, clipLayer }) => `
import geopandas as gpd
from jupytergis import GISDocument
doc = GISDocument("${jgisPath}")

clip_gdf = gpd.read_file("${clipLayer}")

${targetLayer.type === 'VectorLayer' ? `
target_gdf = gpd.read_file("${targetLayer}")
clipped_gdf = gpd.clip(target_gdf, clip_gdf)
clipped_gdf.to_file("${targetLayer}_clipped.geojson", driver="GeoJSON")
doc.add_geojson_layer("${targetLayer}_clipped.geojson")
print("clipped vector layer")` : 
`import rasterio
from rasterio.mask import mask 
with rasterio.open("${targetLayer}") as src:
    out_image, out_transform = mask(src, clip_gdf.geometry, crop=True)
    out_meta = src.meta.copy()
out_meta.update({"driver": "GTiff",
                 "height": out_image.shape[1],
                 "width": out_image.shape[2],
                 "transform": out_transform})
with rasterio.open("${targetLayer}_clipped.tif", "w", **out_meta) as dest:
    dest.write(out_image)
doc.add_raster_layer("${targetLayer}_clipped.tif")
print("clipped raster layer")`}`,

    }
);