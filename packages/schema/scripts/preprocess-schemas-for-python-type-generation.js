#!/usr/bin/env node

/**
 * Preprocesses JSON schemas for Python type generation by replacing
 * $ref paths which are relative to the schema root directory with paths which
 * are relative to the file containing the $ref.
 *
 * This is a difference between how jsonschema-to-typescript and
 * datamodel-codegen process $refs; I believe there is no way to write a $ref
 * containing a path which is compatible with both unless our schemas are all
 * in a flat directory structure.
 */

const fs = require('fs');
const path = require('path');

const schemaRoot = path.join(__dirname, '..', 'src', 'schema');
const tempDir = path.join(__dirname, '..', 'temp-schema');

/*
 * Rewrite `refValue`, if it contains a path, to be relative to `schemaDir`
 * instead of `schemaRoot`.
 */
function updateRefPath(refValue, schemaDir, schemaRoot) {
  // Handle $ref with optional fragment (e.g., "path/to/file.json#/definitions/something")
  const [refPath, fragment] = refValue.split('#');

  // Check if the referenced file exists
  const absoluteRefPath = path.resolve(schemaRoot, refPath);
  if (!fs.existsSync(absoluteRefPath)) {
    throw new Error(`Referenced file does not exist: ${refPath} (resolved to ${absoluteRefPath})`);
  }

  // Convert schemaRoot-relative path to schemaDir-relative path
  const relativeToCurrentDir = path.relative(schemaDir, absoluteRefPath);

  // Just in case we're on Windows, replace backslashes.
  const newRef = relativeToCurrentDir.replace(/\\/g, '/');

  return fragment ? `${newRef}#${fragment}` : newRef;
}

/*
 * Recursively process `schema` (JSON content) to rewrite `$ref`s containing paths.
 *
 * Any path will be modified to be relative to `schemaDir` instead of relative
 * to `schemaRoot`.
 */
function processSchema(schema, schemaDir, schemaRoot) {
  if (Array.isArray(schema)) {
    // Recurse!
    return schema.map(item => processSchema(item, schemaDir, schemaRoot));
  }

  if (Object.prototype.toString.call(schema) !== '[object Object]') {
    return schema;
  }

  // `schema` is an "object":
  const result = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === '$ref' && typeof value === 'string' && !value.startsWith('#')) {
      result[key] = updateRefPath(value, schemaDir, schemaRoot);
    } else {
      // Recurse!
      result[key] = processSchema(value, schemaDir, schemaRoot);
    }
  }

  return result;
}

/*
 * Recursively rewrite schema files in `src` to `dest`.
 *
 * For each schema, rewrite the paths in JSONSchema `$ref`s to be relative to
 * that schema's parent directory instead of `schemaRoot`.
 */
function preProcessSchemaDirectory(src, dest, schemaRoot) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const children = fs.readdirSync(src, { withFileTypes: true });

  for (const child of children) {
    const srcChild = path.join(src, child.name);
    const destChild = path.join(dest, child.name);

    if (child.isDirectory()) {
      // Recurse!
      preProcessSchemaDirectory(srcChild, destChild, schemaRoot);
    } else if (child.isFile() && child.name.endsWith('.json')) {
      // Process schema JSON to modify $ref paths
      const content = fs.readFileSync(srcChild, 'utf8');
      const schema = JSON.parse(content);
      const processedSchema = processSchema(schema, src, schemaRoot);

      fs.writeFileSync(destChild, JSON.stringify(processedSchema, null, 2));
    } else {
      // There should be no non-JSON files in the schema directory!
      throw new Error(`Non-JSON file detected in schema directory: ${child.parentPath}/${child.name}`);
    }
  }
}

function preProcessSchemas() {
  fs.rmSync(tempDir, { recursive: true, force: true });
  preProcessSchemaDirectory(schemaRoot, tempDir, schemaRoot);
}

console.log(`Pre-processing JSONSchemas for Python type generation (writing to ${tempDir})...`)

preProcessSchemas();

console.log('Schemas pre-processed for Python type generation.');
