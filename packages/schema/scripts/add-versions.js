/*
 * Generate schema version variable for inclusion in the generated TypeScript interfaces.
 */
const path = require("path");
const fs = require("fs");

const packagePath = path.resolve(path.join(__dirname, "../"));
const schemaPath = path.join(packagePath, "src/schema");

const schema = JSON.parse(
  fs.readFileSync(path.join(schemaPath, "project/jgis.json")),
);

const version = schema.properties.version.default;
const schemaVersion = schema.properties.schemaVersion.default;

fs.writeFileSync(path.join(packagePath, "src/_interface/version.d.ts"),
`export declare const VERSION = '${version}';\n` +
 `export declare const SCHEMA_VERSION = '${schemaVersion}';\n`);

fs.writeFileSync(path.join(packagePath, "src/_interface/version.js"),
`export const VERSION = '${version}';\n` +
 `export const SCHEMA_VERSION = '${schemaVersion}';\n`);
