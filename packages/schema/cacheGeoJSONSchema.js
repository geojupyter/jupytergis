const fs = require('fs');
const https = require('https');
const path = require('path');

const schemaUrl = 'https://geojson.org/schema/GeoJSON.json';
const cacheDir = path.resolve(__dirname, './src/schema');
const schemaFile = path.join(cacheDir, 'geojson.json');

if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

if (fs.existsSync(schemaFile)) {
  
} else {
  
  const file = fs.createWriteStream(schemaFile);
  https
    .get(schemaUrl, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        
      });
    })
    .on('error', (err) => {
      fs.unlink(schemaFile);
      console.error('Failed to download GeoJSON schema:', err.message);
      process.exit(1);
    });
}
