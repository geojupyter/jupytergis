import { expect, test } from '@jupyterlab/galata';

/**
 * Isolates whether any cell execution reaches Idle in CI.
 * If xpython fails but python3 passes, the hang is xeus-specific.
 */
const KERNELS = [
  { id: 'xpython', toolbarLabel: 'XPython' },
  { id: 'python3', toolbarLabel: 'Python 3' },
] as const;

test.describe('Kernel smoke', () => {
  test.setTimeout(60_000);

  for (const kernel of KERNELS) {
    test(`${kernel.id}: print(1) reaches Idle`, async ({ page }) => {
      const name = await page.notebook.createNew(`smoke-${kernel.id}.ipynb`, {
        kernel: kernel.id,
      });
      expect(name).toBeTruthy();

      await expect(
        page.getByRole('toolbar', { name: 'main area toolbar' }).getByText(
          kernel.toolbarLabel,
        ),
      ).toBeVisible({ timeout: 30_000 });

      await page.notebook.setCell(0, 'code', 'print(1)');
      await page.notebook.runCell(0, true);

      await expect(
        page.locator('#jp-main-statusbar').getByText('Idle'),
      ).toBeVisible();

      // Prompt should leave [*] and show an execution count.
      await expect(
        page.locator('.jp-CodeCell .jp-InputArea-prompt').first(),
      ).toHaveText(/\[\d+\]:/);

      await page.notebook.close(true);
    });
  }
});
