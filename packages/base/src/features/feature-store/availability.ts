import { URLExt } from '@jupyterlab/coreutils';
import { ServerConnection } from '@jupyterlab/services';

const FEATURE_STORE_CHECK_ENDPOINT = 'jupytergis_core/feature-store-check';

/**
 * True when the server has both JGIS_POSTGIS_URL and JGIS_TIPG_URL.
 * Set once at startup by checkFeatureStoreAvailability.
 */
let _featureStoreAvailable = false;

export function isFeatureStoreAvailable(): boolean {
  return _featureStoreAvailable;
}

export function setFeatureStoreAvailable(available: boolean): void {
  _featureStoreAvailable = available;
}

export async function checkFeatureStoreAvailability(): Promise<boolean> {
  try {
    const settings = ServerConnection.makeSettings();
    const url = URLExt.join(settings.baseUrl, FEATURE_STORE_CHECK_ENDPOINT);
    const response = await ServerConnection.makeRequest(
      url,
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
      settings,
    );

    if (response.ok) {
      const data = await response.json();
      _featureStoreAvailable = data.available === true;
    } else {
      _featureStoreAvailable = false;
    }
  } catch {
    _featureStoreAvailable = false;
  }

  return _featureStoreAvailable;
}
