const path = require('path');
const fs = require('fs');
const $RefParser = require('@apidevtools/json-schema-ref-parser');
const schemaPath = path.join(__dirname, 'src/schema');
const allSchema = {};
const files = fs.readdirSync(schemaPath);

fs.cpSync(path.join(__dirname, 'src/_interface'),'../../lib/_interface', {recursive: true})

files.forEach(file => {
  const rawData = fs.readFileSync(path.join(schemaPath, file));
  const data = JSON.parse(rawData);

  $RefParser.dereference(data, (err, rschema) => {
    if (err) {
      console.error(err);
    } else {
      if (rschema['description']) {
        const { description, title, ...props } = rschema;
        allSchema[description] = props;
      }
      fs.writeFileSync(
        '../../lib/_interface/forms.json',
        JSON.stringify(allSchema, null, 2)
      );
    }
  });
});
