import initGdalJs from 'gdal3.js';

export async function getGdal() {
  const dataurl = new URL('./gdal3WebAssembly.data', import.meta.url);
  const wasmurl = new URL('./gdal3WebAssembly.wasm', import.meta.url);

  // TODO Pass gdal JS too and run gdal in a worker?
  return await initGdalJs({
    paths: {
      wasm: wasmurl.href,
      data: dataurl.href,
    },
    useWorker: false,
  });
}
