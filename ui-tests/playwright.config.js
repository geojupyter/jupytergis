/**
 * Configuration for Playwright using default from @jupyterlab/galata
 */
const baseConfig = require("@jupyterlab/galata/lib/playwright-config");

module.exports = {
  ...baseConfig,
  webServer: {
    command: "jlpm start",
    url: "http://localhost:8888/lab",
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
  retries: process.env.CI ? 1 : 0,
  use: {
    ...baseConfig.use,
    trace: "on-first-retry",
  },
  expect: {
    toMatchSnapshot: {
      maxDiffPixelRatio: 0.002,
    },
  },
};
