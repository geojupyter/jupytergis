const path = require("path");
const fs = require("fs");
const $RefParser = require("@apidevtools/json-schema-ref-parser");
const schemaPath = path.join(__dirname, "src/schema");
const allSchema = {};

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


fs.cpSync(path.join(__dirname, "src/_interface"), "../../lib/_interface", {
  recursive: true,
});

// Process all schema files
const schemaFiles = getSchemaFiles(schemaPath);

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
        "../../lib/_interface/forms.json",
        JSON.stringify(allSchema, null, 2),
      );
    }
  });
});
