/**
 * @jest-environment jsdom
 */

import { whenImagesSettled } from '../utils/whenImagesSettled';

describe('whenImagesSettled', () => {
  it('invokes callback immediately when there are no images', () => {
    const root = document.createElement('div');
    const callback = jest.fn();

    whenImagesSettled(root, callback);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('invokes callback immediately when all images are already complete', () => {
    const root = document.createElement('div');
    const img = document.createElement('img');
    Object.defineProperty(img, 'complete', { value: true });
    root.append(img);

    const callback = jest.fn();
    whenImagesSettled(root, callback);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('waits for pending images to load', () => {
    const root = document.createElement('div');
    const img = document.createElement('img');
    Object.defineProperty(img, 'complete', { value: false });
    root.append(img);

    const callback = jest.fn();
    whenImagesSettled(root, callback);
    expect(callback).not.toHaveBeenCalled();

    img.dispatchEvent(new Event('load'));
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('treats image errors as settled', () => {
    const root = document.createElement('div');
    const img = document.createElement('img');
    Object.defineProperty(img, 'complete', { value: false });
    root.append(img);

    const callback = jest.fn();
    whenImagesSettled(root, callback);

    img.dispatchEvent(new Event('error'));
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does not invoke callback after cancel', () => {
    const root = document.createElement('div');
    const img = document.createElement('img');
    Object.defineProperty(img, 'complete', { value: false });
    root.append(img);

    const callback = jest.fn();
    const cancel = whenImagesSettled(root, callback);
    cancel();

    img.dispatchEvent(new Event('load'));
    expect(callback).not.toHaveBeenCalled();
  });
});
