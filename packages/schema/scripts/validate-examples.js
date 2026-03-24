/**
 * Validate all .jGIS files in the examples directory against the jGIS schema.
 * Validates both root structure and each layer/source parameters against type-specific schemas.
 * Run from repo root: node packages/schema/scripts/validate-examples.js
 */

const path = require('path');
const fs = require('fs');
const Ajv = require('ajv').default;
const $RefParser = require('@apidevtools/json-schema-ref-parser');

const repoRoot = path.resolve(__dirname, '../../..');
const examplesDir = path.join(repoRoot, 'examples');
const schemaDir = path.join(__dirname, '../src/schema/project');
const jgisSchemaPath = path.join(schemaDir, 'jgis.json');

const LAYER_SCHEMAS = {
  RasterLayer: 'layers/rasterLayer.json',
  VectorLayer: 'layers/vectorLayer.json',
  VectorTileLayer: 'layers/vectorTileLayer.json',
  HillshadeLayer: 'layers/hillshadeLayer.json',
  WebGlLayer: 'layers/webGlLayer.json',
  ImageLayer: 'layers/imageLayer.json',
  HeatmapLayer: 'layers/heatmapLayer.json',
  StacLayer: 'layers/stacLayer.json',
  StorySegmentLayer: 'layers/storySegmentLayer.json',
};

const SOURCE_SCHEMAS = {
  RasterSource: 'sources/rasterSource.json',
  VectorTileSource: 'sources/vectorTileSource.json',
  GeoJSONSource: 'sources/geoJsonSource.json',
  RasterDemSource: 'sources/rasterDemSource.json',
  VideoSource: 'sources/videoSource.json',
  ImageSource: 'sources/imageSource.json',
  ShapefileSource: 'sources/shapefileSource.json',
  GeoTiffSource: 'sources/geoTiffSource.json',
  GeoParquetSource: 'sources/geoParquetSource.json',
  MarkerSource: 'sources/markerSource.json',
};

function findJgisFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      findJgisFiles(full, files);
    } else if (e.name.endsWith('.jGIS') || e.name.endsWith('.jgis')) {
      files.push(full);
    }
  }
  return files;
}

async function loadDereferencedSchema(relativePath) {
  const fullPath = path.join(schemaDir, relativePath);
  return $RefParser.dereference(fullPath);
}

async function main() {
  const jgisSchema = JSON.parse(fs.readFileSync(jgisSchemaPath, 'utf8'));
  const ajvRoot = new Ajv({
    allErrors: true,
    strict: false,
    multipleOfPrecision: 2,
  });
  const validateRoot = ajvRoot.compile(jgisSchema);

  const layerValidators = {};
  const sourceValidators = {};
  const ajvParams = new Ajv({
    allErrors: true,
    strict: false,
    multipleOfPrecision: 2,
  });

  for (const [type, relPath] of Object.entries(LAYER_SCHEMAS)) {
    try {
      const schema = await loadDereferencedSchema(relPath);
      layerValidators[type] = ajvParams.compile(schema);
    } catch (err) {
      console.warn(`Warning: could not load layer schema ${relPath}:`, err.message);
    }
  }
  for (const [type, relPath] of Object.entries(SOURCE_SCHEMAS)) {
    try {
      const schema = await loadDereferencedSchema(relPath);
      sourceValidators[type] = ajvParams.compile(schema);
    } catch (err) {
      console.warn(`Warning: could not load source schema ${relPath}:`, err.message);
    }
  }

  function formatError(e, prefix) {
    let msg = `${prefix} ${e.instancePath || '/parameters'} ${e.message}`;
    if (e.params && e.message && e.message.includes('additional propert')) {
      const prop = e.params.additionalProperty;
      if (prop !== undefined) {
        msg += ` (disallowed key: "${prop}")`;
      }
    }
    return msg;
  }

  const jgisFiles = findJgisFiles(examplesDir);
  const failures = [];

  for (const file of jgisFiles) {
    const rel = path.relative(repoRoot, file);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      failures.push({ file: rel, errors: [`Parse error: ${err.message}`] });
      continue;
    }

    if (!validateRoot(data)) {
      const errs = (validateRoot.errors || []).map(
        (e) => `[root] ${e.instancePath || '/'} ${e.message}`
      );
      failures.push({ file: rel, errors: errs });
      continue;
    }

    const layers = data.layers || {};
    const sources = data.sources || {};

    for (const [layerId, layer] of Object.entries(layers)) {
      const params = layer.parameters || {};
      const validator = layerValidators[layer.type];
      if (!validator) continue;
      if (!validator(params)) {
        const prefix = `[layer ${layerId} (${layer.name}, ${layer.type})]`;
        const errs = (validator.errors || []).map((e) => formatError(e, prefix));
        failures.push({ file: rel, errors: errs });
      }
    }

    for (const [sourceId, source] of Object.entries(sources)) {
      const params = source.parameters || {};
      const validator = sourceValidators[source.type];
      if (!validator) continue;
      if (!validator(params)) {
        const prefix = `[source ${sourceId} (${source.name}, ${source.type})]`;
        const errs = (validator.errors || []).map((e) => formatError(e, prefix));
        failures.push({ file: rel, errors: errs });
      }
    }
  }

  if (failures.length > 0) {
    console.log('Examples that do NOT match the schema:\n');
    for (const r of failures) {
      console.log(r.file);
      for (const e of r.errors) {
        console.log('  -', e);
      }
      console.log('');
    }
    process.exit(1);
  } else {
    console.log('All', jgisFiles.length, 'example .jGIS files match the schema.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
