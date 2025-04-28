import { ISettingRegistry } from '@jupyterlab/settingregistry';

const SETTINGS_ID = '@jupytergis/jupytergis-core:jupytergis-settings';

/**
 * Default settings state.
 */
const settingsState = {
  proxyUrl: 'https://corsproxy.io'
};

/**
 * Initialize settings from the JupyterLab setting registry.
 */
export const initSettings = async (
  settingRegistry: ISettingRegistry
): Promise<void> => {
  const setting = await settingRegistry.load(SETTINGS_ID);

  const userSettings = setting.user ?? {};

  settingsState.proxyUrl =
    (userSettings as any).proxyUrl ?? settingsState.proxyUrl;
};

/**
 * Get the full current settings.
 */
export const getSettings = () => settingsState;
