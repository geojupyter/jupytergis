/*
 * Generate schema version variable for inclusion in the generated TypeScript interfaces.
 */
const path = require("path");
const fs = require("fs");

const packagePath = path.resolve(path.join(__dirname, "../"));
const schemaPath = path.join(packagePath, "src/schema");

const version = JSON.parse(fs.readFileSync(path.join(schemaPath, "project/jgis.json"))).properties.schemaVersion.default;
fs.writeFileSync(path.join(packagePath, "src/_interface/version.d.ts"), `export declare const SCHEMA_VERSION = '${version}';\n`);
fs.writeFileSync(path.join(packagePath, "src/_interface/version.js"), `export const SCHEMA_VERSION = '${version}';\n`);
