/**
 * Configuration for Playwright using default from @jupyterlab/galata
 */
const baseConfig = require('@jupyterlab/galata/lib/playwright-config');

module.exports = {
  ...baseConfig,
  webServer: {
    command: 'jlpm start:lite',
    url: 'http://localhost:8000/',
    timeout: 10 * 1000,
    reuseExistingServer: false
  },
  retries: 1,
  use: {
    ...baseConfig.use,
    acceptDownloads: true,
    appPath: '',
    autoGoto: false,
    baseURL: 'http://localhost:8000',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  expect: {
    toMatchSnapshot: {
      maxDiffPixelRatio: 0.002,
    },
  },
};
