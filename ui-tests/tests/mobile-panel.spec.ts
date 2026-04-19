import { galata, test } from '@jupyterlab/galata';
import { expect } from '@playwright/test';
import path from 'path';

const FILENAME = 'panel-test.jGIS';
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };

test.describe('#mobilePanel', () => {
  test.beforeAll(async ({ request }) => {
    const content = galata.newContentsHelper(request);
    await content.deleteDirectory('/testDir');
    await content.uploadDirectory(
      path.resolve(__dirname, './gis-files'),
      '/testDir',
    );
  });

  test.afterEach(async ({ page }) => {
    await page.activity.closeAll();
  });

  test('merged panel is visible on mobile viewport', async ({ page }) => {
    page.setViewportSize(MOBILE_VIEWPORT);
    await page.filebrowser.open(`testDir/${FILENAME}`);
    await page.locator('div.jGIS-Spinner').waitFor({ state: 'hidden' });

    const mergedPanel = page.locator('.jgis-merged-panel-container');
    await expect(mergedPanel).toBeVisible();
  });

  test('separate left/right panels are not shown on mobile', async ({
    page,
  }) => {
    page.setViewportSize(MOBILE_VIEWPORT);
    await page.filebrowser.open(`testDir/${FILENAME}`);
    await page.locator('div.jGIS-Spinner').waitFor({ state: 'hidden' });

    // On mobile the merged panel is used; the desktop panel containers
    // should not be present as standalone positioned elements
    await expect(page.locator('.jgis-merged-panel-container')).toBeVisible();
    await expect(page.locator('.jgis-left-panel-container')).not.toBeVisible();
    await expect(page.locator('.jgis-right-panel-container')).not.toBeVisible();
  });

  test('merged panel is not shown on desktop viewport', async ({ page }) => {
    page.setViewportSize(DESKTOP_VIEWPORT);
    await page.filebrowser.open(`testDir/${FILENAME}`);
    await page.locator('div.jGIS-Spinner').waitFor({ state: 'hidden' });

    await expect(
      page.locator('.jgis-merged-panel-container'),
    ).not.toBeVisible();
    await expect(page.locator('.jgis-left-panel-container')).toBeVisible();
  });

  test('pill indicator is visible on mobile', async ({ page }) => {
    page.setViewportSize(MOBILE_VIEWPORT);
    await page.filebrowser.open(`testDir/${FILENAME}`);
    await page.locator('div.jGIS-Spinner').waitFor({ state: 'hidden' });

    await expect(page.locator('.jgis-resize-handle')).toBeVisible();
  });

  test('clicking a tab switches the active tab', async ({ page }) => {
    page.setViewportSize(MOBILE_VIEWPORT);
    await page.filebrowser.open(`testDir/${FILENAME}`);
    await page.locator('div.jGIS-Spinner').waitFor({ state: 'hidden' });

    const panel = page.locator('.jgis-merged-panel-container');
    const triggers = panel.locator('.jgis-tabs-trigger');

    // Click the second enabled tab
    const secondTab = triggers.nth(1);
    const secondTabName = await secondTab.textContent();
    await secondTab.click();

    // That tab should now be active
    await expect(secondTab).toHaveAttribute('data-state', 'active');

    // Click back to the first tab
    await triggers.nth(0).click();
    await expect(triggers.nth(0)).toHaveAttribute('data-state', 'active');
    await expect(secondTab).toHaveAttribute('data-state', 'inactive');

    console.log(`Tab switching verified for: ${secondTabName}`);
  });

  test('dragging tab list vertically resizes the panel', async ({ page }) => {
    page.setViewportSize(MOBILE_VIEWPORT);
    await page.filebrowser.open(`testDir/${FILENAME}`);
    await page.locator('div.jGIS-Spinner').waitFor({ state: 'hidden' });

    const panel = page.locator('.jgis-merged-panel-container');
    const tabList = panel.locator('.jgis-tabs-list');

    const initialBox = await panel.boundingBox();
    expect(initialBox).not.toBeNull();

    // Drag the tab list upward to expand the panel
    const tabBox = await tabList.boundingBox();
    expect(tabBox).not.toBeNull();

    const startX = tabBox!.x + tabBox!.width / 2;
    const startY = tabBox!.y + tabBox!.height / 2;
    const dragDistance = 100;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    // Move slowly to trigger direction detection
    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(startX, startY - (dragDistance * i) / 10);
    }
    await page.mouse.up();

    const resizedBox = await panel.boundingBox();
    expect(resizedBox).not.toBeNull();
    expect(resizedBox!.height).toBeGreaterThan(initialBox!.height + 50);
  });
});
