import { IJGISSourceDocChange, IJupyterGISModel } from '@jupytergis/schema';
import { IDisposable } from '@lumino/disposable';

import { populateSourceMetadata } from './registry';

/**
 * Read and store metadata for sources added during this session.
 *
 * Populating happens when a source is *added*, which is a moment the document
 * is already being written to, so the metadata rides along on a write that was
 * happening anyway. Deliberately not done when a document is opened: sources
 * that were already in the file are left alone and are read lazily by the
 * Information tab instead, so that merely viewing a project never modifies it
 * — and never fires a burst of network reads for layers nobody looked at.
 */
export function watchSourceMetadata(
  model: IJupyterGISModel,
  ready: Promise<unknown>,
): IDisposable {
  // Sources present before this watcher started are pre-existing, not new,
  // however they arrived: opening a file populates the shared map in one go and
  // is indistinguishable from a burst of additions at the signal level.
  const known = new Set<string>();
  const inFlight = new Set<string>();
  let disposed = false;

  const onSourcesChanged = (_: unknown, change: IJGISSourceDocChange): void => {
    for (const { id, newValue } of change.sourceChange ?? []) {
      if (!newValue) {
        known.delete(id);
        continue;
      }

      if (known.has(id) || inFlight.has(id)) {
        continue;
      }

      known.add(id);
      inFlight.add(id);

      // Storing metadata itself changes the source, which re-emits this signal.
      // That pass is harmless — the stored fingerprint is current by then, so
      // `populateSourceMetadata` returns without doing anything — but the id is
      // in `known` regardless, so it never gets that far.
      populateSourceMetadata(model, id)
        .catch(error => {
          console.debug(`Could not read metadata for source ${id}:`, error);
        })
        .finally(() => inFlight.delete(id));
    }
  };

  void ready.then(() => {
    if (disposed) {
      return;
    }

    for (const id of Object.keys(model.getSources() ?? {})) {
      known.add(id);
    }

    model.sharedModel.sourcesChanged.connect(onSourcesChanged);
  });

  return {
    get isDisposed() {
      return disposed;
    },
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      model.sharedModel.sourcesChanged.disconnect(onSourcesChanged);
    },
  };
}
