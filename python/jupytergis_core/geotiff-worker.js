export default function create() {
  return new Worker(
    new URL('geotiff/dist-module/worker/decoder.js', import.meta.url),
  );
}
