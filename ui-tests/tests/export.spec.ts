import { expect, galata, test } from '@jupyterlab/galata';
import path from 'path';

test.describe('#export', () => {
  test.beforeAll(async ({ request }) => {
    const content = galata.newContentsHelper(request);
    await content.deleteDirectory('/testDir');
    await content.uploadDirectory(
      path.resolve(__dirname, './gis-files'),
      '/testDir'
    );
  });

  test('should have the menu item', async ({ page }) => {
    // Should have a disabled menu item without GIS project opened.
    await page.menu.open('File');
    let menuItem = await page.menu.getMenuItem('File>Export To QGZ');
    expect(menuItem).not.toBeNull();
    expect(await menuItem?.getAttribute('aria-disabled')).toBeTruthy();
    await page.menu.closeAll();

    // Should enable the menu item.
    await page.filebrowser.open('testDir/france-hiking.jGIS');
    await page.menu.open('File');
    menuItem = await page.menu.getMenuItem('File>Export To QGZ');
    expect(await menuItem?.getAttribute('aria-disabled')).toBeFalsy();
  });

  test('should not export to qgis on cancel', async ({ page }) => {
    await page.filebrowser.open('testDir/france-hiking.jGIS');
    await page.menu.clickMenuItem('File>Export To QGZ');

    const dialog = page.locator('.jp-Dialog');
    await expect(dialog).toBeAttached();
    await dialog.locator('.jp-mod-reject').click();
    await page.filebrowser.refresh();
    expect(
      await page.filebrowser.contents.fileExists('testDir/france-hiking.qgz')
    ).toBeFalsy();
  });

  test('should export to qgis with default name', async ({ page }) => {
    await page.filebrowser.open('testDir/france-hiking.jGIS');
    await page.menu.clickMenuItem('File>Export To QGZ');

    const dialog = page.locator('.jp-Dialog');
    await expect(dialog).toBeAttached();
    await dialog.locator('.jp-mod-accept').click();
    await page.filebrowser.refresh();
    expect(
      await page.filebrowser.contents.fileExists('testDir/france-hiking.qgz')
    ).toBeTruthy();
  });

  test('should export to qgis with custom name', async ({ page }) => {
    const filename = 'custom-name';
    await page.filebrowser.open('testDir/france-hiking.jGIS');
    await page.menu.clickMenuItem('File>Export To QGZ');

    const dialog = page.locator('.jp-Dialog');
    await expect(dialog).toBeAttached();
    await dialog.getByRole('textbox').fill(filename);
    await dialog.locator('.jp-mod-accept').click();
    await page.filebrowser.refresh();
    expect(
      await page.filebrowser.contents.fileExists(`testDir/${filename}.qgz`)
    ).toBeTruthy();
  });
});
