import initGdalJs from 'gdal3.js';

export async function getGdal() {
  const dataurl = new URL('./gdal3WebAssembly.data', import.meta.url);
  const wasmurl = new URL('./gdal3WebAssembly.wasm', import.meta.url);
  const jsurl = new URL('./gdal3.js', import.meta.url);

  return await initGdalJs({
    paths: {
      wasm: wasmurl.href,
      data: dataurl.href,
      js: jsurl.href
    },
    useWorker: true
  });
}

// Early load gdal
getGdal();
