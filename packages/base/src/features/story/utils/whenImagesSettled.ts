/**
 * Invokes callback after all images under root have loaded or errored.
 * Returns a cancel function.
 */
export function whenImagesSettled(
  root: HTMLElement,
  callback: () => void,
): () => void {
  let cancelled = false;

  const cancel = (): void => {
    cancelled = true;
  };

  const images = Array.from(root.querySelectorAll('img'));
  if (images.length === 0) {
    callback();
    return cancel;
  }

  let pending = images.length;

  const settle = (): void => {
    if (cancelled) {
      return;
    }

    pending -= 1;
    if (pending <= 0) {
      callback();
    }
  };

  for (const img of images) {
    if (img.complete) {
      settle();
    } else {
      img.addEventListener('load', settle, { once: true });
      img.addEventListener('error', settle, { once: true });
    }
  }

  return cancel;
}
