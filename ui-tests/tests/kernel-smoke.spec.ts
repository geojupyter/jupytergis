import { expect, test } from '@jupyterlab/galata';
import type { ConsoleMessage, Page } from '@playwright/test';

/**
 * Isolates whether any cell execution reaches Idle in CI.
 * If xpython fails but python3 passes, the hang is xeus-specific.
 *
 * Hooks kernel shell traffic before createNew so we can attribute the xeus
 * "No such comm registered" path to a caller stack.
 */
const KERNELS = [
	{ id: 'xpython', toolbarLabel: 'XPython' },
	{ id: 'python3', toolbarLabel: 'Python 3' },
] as const;

async function installCommDebugHook(page: Page): Promise<void> {
	// Galata already has Lab loaded, so patch the live app (not addInitScript).
	await page.evaluate(() => {
		type CommLogEntry = {
			tag: string;
			msgType: string;
			content: unknown;
			stack?: string;
			at: number;
		};

		const w = window as Window & {
			__commDebugLog?: CommLogEntry[];
			__commDebugPatched?: boolean;
			jupyterapp?: any;
		};

		w.__commDebugLog = [];
		if (w.__commDebugPatched) {
			return;
		}
		w.__commDebugPatched = true;

		const push = (entry: CommLogEntry) => {
			w.__commDebugLog!.push(entry);
			const payload = JSON.stringify(entry.content);
			if (entry.stack) {
				console.warn(entry.tag, entry.msgType, payload, entry.stack);
			} else {
				console.warn(entry.tag, entry.msgType, payload);
			}
		};

		const hookKernel = (kernel: any) => {
			if (!kernel || kernel.__commDebugHooked) {
				return;
			}
			kernel.__commDebugHooked = true;

			const origSend = kernel.sendShellMessage.bind(kernel);
			kernel.sendShellMessage = (msg: any, ...args: unknown[]) => {
				const msgType = String(msg?.header?.msg_type ?? '');
				if (msgType.startsWith('comm')) {
					push({
						tag: '[comm-out]',
						msgType,
						content: msg?.content,
						stack: new Error().stack,
						at: Date.now(),
					});
				}
				return origSend(msg, ...args);
			};

			kernel.anyMessage?.connect(
				(_: unknown, args: { msg: any; direction: string }) => {
					const msgType = String(args.msg?.header?.msg_type ?? '');
					if (!msgType.startsWith('comm')) {
						return;
					}
					push({
						tag: `[comm-${args.direction}]`,
						msgType,
						content: args.msg?.content,
						at: Date.now(),
					});
				},
			);
		};

		const attachSession = (session: any) => {
			hookKernel(session.kernel);
			session.kernelChanged.connect(
				(_: unknown, { newValue }: { newValue: unknown }) => {
					hookKernel(newValue);
				},
			);
		};

		const app = w.jupyterapp;
		if (!app) {
			throw new Error('jupyterapp not ready for comm debug hook');
		}

		// Hook kernels as soon as they are created (covers startNew → connectTo).
		const kernels = app.serviceManager.kernels;
		const origKernelConnectTo = kernels.connectTo.bind(kernels);
		kernels.connectTo = (options: unknown) => {
			const kernel = origKernelConnectTo(options);
			hookKernel(kernel);
			return kernel;
		};

		const sessions = app.serviceManager.sessions;
		const origConnectTo = sessions.connectTo.bind(sessions);
		sessions.connectTo = async (options: unknown) => {
			const session = await origConnectTo(options);
			attachSession(session);
			return session;
		};
	});
}

async function dumpCommDebugLog(page: Page): Promise<void> {
	const entries = await page.evaluate(() => {
		return (
			(window as Window & { __commDebugLog?: unknown[] }).__commDebugLog ?? []
		);
	});
	console.log(
		`[kernel-smoke] comm debug log (${entries.length} entries):\n` +
			JSON.stringify(entries, null, 2),
	);
}

test.describe('Kernel smoke', () => {
	test.setTimeout(60_000);

	for (const kernel of KERNELS) {
		test(`${kernel.id}: print(1) reaches Idle`, async ({ page }) => {
			const consoleLines: string[] = [];
			const onConsole = (msg: ConsoleMessage) => {
				const text = msg.text();
				if (text.includes('[comm-')) {
					consoleLines.push(text);
				}
			};
			page.on('console', onConsole);

			await installCommDebugHook(page);

			try {
				const name = await page.notebook.createNew(`smoke-${kernel.id}.ipynb`, {
					kernel: kernel.id,
				});
				expect(name).toBeTruthy();

				await expect(
					page
						.getByRole('toolbar', { name: 'main area toolbar' })
						.getByText(kernel.toolbarLabel),
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
			} finally {
				await dumpCommDebugLog(page);
				if (consoleLines.length) {
					console.log(
						`[kernel-smoke] console comm lines:\n${consoleLines.join('\n')}`,
					);
				}
				page.off('console', onConsole);
			}
		});
	}
});
