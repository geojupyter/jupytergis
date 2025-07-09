/*
 * Dereference all schemas and combine into a single file for building the
 * schema registry (see `python/jupytergis_core/src/schemaregistry.ts`).
 */
const path = require("path");
const fs = require("fs");
const $RefParser = require("@apidevtools/json-schema-ref-parser");

function getSchemaFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);

  list.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat && stat.isDirectory()) {
      // Recursively read from subdirectories
      results = results.concat(getSchemaFiles(fullPath));
    } else if (file.endsWith(".json")) {
      results.push(fullPath);
    }
  });

  return results;
}

// Dereference all schema files and combine into `forms.json`
const packagePath = path.resolve(path.join(__dirname, "../"));
const schemaPath = path.join(packagePath, "src/schema");
const schemaFiles = getSchemaFiles(schemaPath);

const allSchema = {};
schemaFiles.forEach((file) => {
  const rawData = fs.readFileSync(file);
  const data = JSON.parse(rawData);

  $RefParser.dereference(data, (err, rschema) => {
    if (err) {
      console.error(`Error processing ${file}:`, err);
    } else {
      if (rschema["description"]) {
        const { description, title, ...props } = rschema;
        allSchema[description] = props;
      }
      fs.writeFileSync(
        path.join(packagePath, "lib/_interface/forms.json"),
        JSON.stringify(allSchema, null, 2),
      );
    }
  });
});
