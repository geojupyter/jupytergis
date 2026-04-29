import React, { useState } from 'react';

const Form = ({ onExecute, layers, jgisPath }: { onExecute: (code: string) => void, layers: { id: string, name: string, source: any, type: string }[], jgisPath: string }) => {
    const [distance, setDistance] = useState('');
    const [source, setSource] = useState('');
    return (
        <div>
            <label htmlFor="distance">Buffer Distance in meters</label>
            <select id="source" value={source} onChange={e => setSource(e.target.value)}>
                {layers.map(layer => (
                    <option key={layer.id} value={layer.source}>{layer.name}</option>
                ))}
            </select>
            <input id="distance" type="number" placeholder="distance" value={distance} onChange={e => setDistance(e.target.value)} />
            <button onClick={() =>  {
                const code = [
`import geopandas as gpd`,
`from jupytergis import GISDocument`,
`doc = GISDocument("${jgisPath}")`,
``,
`gdf = gpd.read_file('${source}')`,
`gdf = gdf.to_crs(epsg=3857)`,
`gdf['geometry'] = gdf.geometry.buffer(${distance})`,
`gdf = gdf.to_crs(epsg=4326)`,
``,
`gdf.to_file("${source}_buffered.geojson", driver='GeoJSON')`,
`doc.add_geojson_layer("${source}_buffered.geojson")`,
`print('buffered ${distance} meters')`
                ]
                onExecute(code.join('\n'))}}>Generate</button>
        </div>
    );
};

export default { label: 'Buffer', form: Form };
