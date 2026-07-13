/**
 * Custom Vitest pool that runs test files inside a live Foundry VTT world.
 *
 * Ported from the `foundry-vtt-types` fork's runtime harness
 * (github:Fronix/foundry-vtt-types#v14.363.0, tests/pool.ts) with Nimble-specific
 * adaptations documented in tests/integration/README.md.
 *
 * How it works: a Playwright-driven Chromium joins the running Foundry world,
 * a throwaway Vite dev server exposes this repo's files via `/@fs/`, and
 * `tester.ts` is imported into the Foundry page to execute the test files with
 * the real `game` / `CONFIG` / document classes — no mocks.
 */

import { EventEmitter } from 'node:events';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import type { File } from '@vitest/runner';
import { type Browser, type BrowserContext, chromium, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import type { SerializedConfig } from 'vitest';
import type { PoolOptions, PoolWorker, Vitest, WorkerRequest, WorkerResponse } from 'vitest/node';

// This type isn't exported by vitest.
type WorkerExecuteContext = Extract<WorkerRequest, { type: 'run' }>['context'];

declare global {
	interface Window {
		__foundry_vitest__: {
			setup: (config: SerializedConfig) => void;
			run: (context: WorkerExecuteContext) => Promise<File[]>;
			collect: (context: WorkerExecuteContext) => Promise<File[]>;
		};
	}
}

const defaultFoundryUrl = 'http://localhost:30000';
const defaultWorld = 'nimbledev';
const defaultUser = 'Gamemaster';

const testsDir = path.dirname(fileURLToPath(import.meta.url));

interface BrowserData {
	viteUrl: string;
	browser: Browser;
	server: ViteDevServer;
	context: BrowserContext;
	page: Page;
}

let browserData: BrowserData | undefined;

// `start` is effectively called in a `Promise.race` across workers; this lets
// all racing workers await the same one-time browser setup.
let _browserData: Promise<BrowserData> | undefined;

async function setupBrowser(vitest: Vitest): Promise<BrowserData | undefined> {
	if (_browserData != null) {
		// Throw away the error so only the first worker logs it.
		return _browserData.catch(() => undefined);
	}

	_browserData = _setupBrowser(vitest);
	browserData = await _browserData;
	return browserData;
}

// No need to log that the page closed on ctrl+c.
let expectedClose = false;

process.on('SIGINT', () => {
	expectedClose = true;
});

async function _setupBrowser(vitest: Vitest): Promise<BrowserData> {
	const foundryUrl = await getFoundryUrl();

	const headless = process.env.HEADLESS !== 'false';

	// Enable hardware acceleration (for performance).
	const args = ['--enable-gpu', '--ignore-gpu-blocklist'];
	let viewport: { width: number; height: number } | null;
	if (headless) {
		// Foundry hard-requires 1366×768; anything smaller logs a resolution error.
		viewport = { width: 1440, height: 900 };
	} else {
		args.push('--start-maximized');
		viewport = null;
	}

	const browser = await chromium.launch({ headless, args });

	const context = await browser.newContext({
		baseURL: foundryUrl,
		viewport,
	});

	const server = await createServer({
		configFile: false,
		root: path.resolve(testsDir, '..', '..'),
		// Without this, Vite treats the repo's `public/` as its publicDir and
		// refuses the `#system` → `public/system.json` import in test files.
		publicDir: false,
		server: {
			cors: {
				origin: foundryUrl,
			},
			hmr: false,
			watch: null,
		},
		// `tester.ts` imports `@vitest/runner` directly to drive collection, while
		// served test files reach the same APIs via `vitest`. If Vite pre-bundles
		// `vitest` and inlines its own copy of `@vitest/runner`, the test files get
		// a second runner instance whose collector state is never set, so
		// collection throws ("failed to find the current suite"). Keep them
		// external + deduped so there is a single shared instance.
		optimizeDeps: {
			exclude: ['vitest', 'vitest/runners', '@vitest/runner'],
			// Deps imported by an excluded dep are served raw, so CJS ones must be
			// force-included for ESM interop (`vitest > x` = nested-dependency syntax).
			include: ['vitest > expect-type'],
		},
		resolve: {
			dedupe: ['@vitest/runner', 'vitest'],
		},
	});

	await server.listen();

	const { resolvedUrls } = server;
	if (resolvedUrls == null) {
		throw new Error('Vite did not resolve any urls!');
	}

	const viteUrl = resolvedUrls.local[0] ?? resolvedUrls.network[0];
	if (viteUrl == null) {
		throw new Error('Could not get Vite url');
	}

	const page = await context.newPage();
	const showFoundryLogs = process.env.LOG_FOUNDRY_MJS === 'true';
	const showNativeWarnings = process.env.LOG_NATIVE_MESSAGES === 'true';

	// Forward in-page console output to the terminal, tagging each call with the
	// caller's stack so Foundry-internal noise can be filtered out.
	await page.addInitScript(() => {
		const methods = [
			'assert',
			'clear',
			'count',
			'debug',
			'dir',
			'dirxml',
			'error',
			'group',
			'groupCollapsed',
			'groupEnd',
			'info',
			'log',
			'table',
			'timeEnd',
			'trace',
			'warn',
		] as const;

		for (const method of methods) {
			const original = console[method] as (...args: unknown[]) => void;

			console[method] = function (...args: unknown[]) {
				const stack = { stack: '' };
				Error.captureStackTrace(stack);

				const serialized = args.map((arg) => {
					if (typeof arg === 'function') {
						// Functions would display as "null" rather confusingly.
						return arg.toString();
					}
					if (arg instanceof HTMLElement) {
						// Nodes would display as "Ref@node" or the like.
						return arg.outerHTML;
					}
					return arg;
				});

				// @ts-expect-error - Untyped global exposed by the pool.
				window.__send_log__(method, serialized, stack.stack);
				original.call(this, ...args);
			};
		}
	});

	await page.exposeFunction('__send_log__', (type: string, args: unknown[], stack: string) => {
		// Frame 0 is the console override itself; frame 1 is the real caller.
		const callerLine = stack.split('\n')[2] ?? '';
		const isFoundryMJS = callerLine.includes('/scripts/foundry.mjs');

		if (isFoundryMJS && !showFoundryLogs) {
			return;
		}

		if (type === 'clear') {
			console.log('[Browser cleared log]');
		} else {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(console as any)[type]?.(...args);
		}
	});

	page.on('console', (message) => {
		const location = message.location();

		if (location.lineNumber === 0 && location.columnNumber === 0) {
			const messageType = message.type();

			if (messageType === 'error') {
				console.error(message.text(), message.location().url);
			} else if (showNativeWarnings) {
				if (messageType === 'warning') {
					console.warn(`[native] ${message.text()}`);
				} else {
					console.log(`[native] ${message.text()}`);
				}
			}
		}
	});

	// Unlike the fork (which throws), log uncaught page errors and keep running:
	// the system under test may have known uncaught errors that the integration
	// suite exists to characterize — crashing the pool would hide them.
	page.on('pageerror', (err: Error) => {
		console.error('[pageerror]', err);
	});

	page.on('close', () => {
		if (expectedClose) {
			return;
		}

		throw new Error('Page unexpectedly closed!');
	});

	page.on('crash', () => {
		throw new Error('Page crashed!');
	});

	vitest.onClose(async () => {
		expectedClose = true;
		await page.close();
		await context.close();
		await browser.close();
		await server.close();
	});

	await joinWorld(page);

	const throttleCanvas = process.env.THROTTLE_CANVAS === 'true';
	if (throttleCanvas) {
		// Lower the performance and fps so tests run quicker.
		await page.evaluate(async () => {
			canvas!.app!.ticker.maxFPS = PIXI.Ticker.shared.maxFPS = 0.25;
			canvas!.performance!.fps = 0.25;
			canvas!.performance!.msaa = false;
			canvas!.performance!.smaa = false;
		});
	}

	return { viteUrl, browser, server, context, page };
}

/**
 * Navigate to the world's join screen and log in.
 *
 * Handles the case where Foundry is sitting on the /setup screen with no world
 * active by launching `FOUNDRY_WORLD` (default `nimbledev`) first.
 */
async function joinWorld(page: Page): Promise<void> {
	const world = process.env.FOUNDRY_WORLD ?? defaultWorld;
	const user = process.env.FOUNDRY_TEST_USER ?? defaultUser;

	await page.goto('/');

	let pathname = new URL(page.url()).pathname;

	if (pathname.endsWith('/auth')) {
		throw new Error(
			'Foundry is asking for the admin password (/auth). The harness cannot log into the setup screen; launch the world manually or remove the admin password.',
		);
	}

	if (pathname.endsWith('/setup')) {
		console.info(`Foundry is on the setup screen; launching world "${world}"...`);

		await page.evaluate(async (worldId) => {
			await foundry.utils.fetchJsonWithTimeout(foundry.utils.getRoute('setup'), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'launchWorld', world: worldId }),
			});
		}, world);

		await page.waitForURL('**/join', { timeout: 60_000 }).catch(async () => {
			// Some Foundry builds don't auto-redirect the setup tab.
			await page.goto('/join');
		});

		pathname = new URL(page.url()).pathname;
	}

	if (!pathname.endsWith('/join')) {
		throw new Error(`Expected to be on /join but got pathname ${pathname}`);
	}

	await page.selectOption('[name=userid]', { label: user });
	await page.click('[name=join]');
	await page.waitForURL('**/game');
	await page.waitForFunction(() => typeof game !== 'undefined' && game.ready);

	console.info(`Joined world "${world}" as "${user}".`);
}

async function getFoundryUrl(): Promise<string> {
	const foundryUrl = process.env.FOUNDRY_URL;
	if (foundryUrl != null) {
		const isRunning = await checkFoundryUrl(foundryUrl);
		if (isRunning) {
			console.info(`Using Foundry running at FOUNDRY_URL = ${foundryUrl}.`);
			return foundryUrl;
		}

		let note = '';

		const url = new URL(foundryUrl);
		if (url.hostname === 'localhost' && isWSL2()) {
			note =
				' Note that WSL 2 cannot connect to Windows through localhost. If Foundry is running on Windows you must either use $(hostname).local or get the default route under ip config.';
		}

		throw new Error(
			`Could not connect to Foundry at FOUNDRY_URL ${foundryUrl}. Have you started Foundry?${note}`,
		);
	}

	if (isWSL2()) {
		const hostname = os.hostname();
		const prettyWindowsUrl = 'http://$(hostname).local:30000';
		const windowsUrl = `http://${hostname}.local:30000`;

		const runningOnWindows = await checkFoundryUrl(windowsUrl);
		const runningOnWSL = await checkFoundryUrl(defaultFoundryUrl);

		if (runningOnWindows && runningOnWSL) {
			throw new Error(
				`Foundry is running on both Windows (${prettyWindowsUrl}) and WSL 2 (${defaultFoundryUrl})! Please configure FOUNDRY_URL in .env.local to disambiguate.`,
			);
		}

		if (runningOnWindows) {
			console.info(`Detected Foundry running on Windows at ${prettyWindowsUrl} (${windowsUrl}).`);
			return windowsUrl;
		}

		if (runningOnWSL) {
			console.info(`Detected Foundry running on WSL 2 at ${defaultFoundryUrl}.`);
			return defaultFoundryUrl;
		}

		throw new Error(
			`Foundry does not appear to be running; checked WSL 2 (${defaultFoundryUrl}) and Windows (${prettyWindowsUrl}). If Foundry is running on Windows and is not detected your mDNS setup may be broken. Otherwise please configure FOUNDRY_URL in .env.local if you have Foundry running elsewhere.`,
		);
	}

	const isRunning = await checkFoundryUrl(defaultFoundryUrl);
	if (!isRunning) {
		throw new Error(
			`Foundry does not appear to be running; checked ${defaultFoundryUrl}. Please configure FOUNDRY_URL in .env.local if you have Foundry running elsewhere.`,
		);
	}

	console.info(`Detected Foundry running at ${defaultFoundryUrl}.`);
	return defaultFoundryUrl;
}

async function checkFoundryUrl(foundryUrl: string): Promise<boolean> {
	const url = new URL(foundryUrl);

	let port: number | undefined = url.port !== '' ? Number(url.port) : undefined;

	if (url.protocol === 'http:') {
		port ??= 80;
	} else if (url.protocol === 'https:') {
		port ??= 443;
	} else {
		throw new Error(`Unexpected protocol ${url.protocol}, only http and https is supported`);
	}

	// Windows can block ICMP from WSL 2 -> Windows so only a tcp level ping works.
	const result = await tcpPing(url.hostname, port);
	return result.isSuccess;
}

// A cached value of whether the current environment is WSL 2.
let _isWSL2: boolean | undefined;

function isWSL2(): boolean {
	if (_isWSL2 != null) {
		return _isWSL2;
	}

	_isWSL2 = os.release().endsWith('-microsoft-standard-WSL2');
	return _isWSL2;
}

function tcpPing(host: string, port: number, timeout = 3000) {
	return new Promise<{ isSuccess: true } | { isSuccess: false; error: Error }>((resolve) => {
		const socket = new net.Socket();

		socket.setTimeout(timeout);

		socket.connect(port, host, () => {
			socket.end();
			resolve({ isSuccess: true });
		});

		socket.on('timeout', () => {
			socket.destroy();
			resolve({ isSuccess: false, error: new Error('Socket timed out') });
		});

		socket.on('error', (err) => {
			socket.destroy();
			resolve({ isSuccess: false, error: err });
		});
	});
}

let isSetup = false;

class FoundryBrowserWorker implements PoolWorker {
	name = 'foundry-browser-worker';
	options: PoolOptions;

	constructor(options: PoolOptions) {
		this.options = options;
	}

	send(request: WorkerRequest): void {
		void this.doRequest(request).then(
			(response) => {
				this.events.emit('message', response);
			},
			(error) => {
				this.events.emit('error', error);
			},
		);
	}

	async doRequest(request: WorkerRequest): Promise<WorkerResponse> {
		const requestType = request.type;
		const { vitest } = this.options.project;

		if (requestType === 'start') {
			if (isSetup) {
				return {
					__vitest_worker_response__: true,
					type: 'started',
				};
			}

			// Setup was kicked off (not awaited) in `start`; block the first
			// request on it instead so vitest's hard 5s runner-start cap
			// doesn't kill the browser launch + world join.
			const data = await _browserData?.catch(() => undefined);
			const viteUrl = data?.viteUrl;
			if (viteUrl == null) {
				throw new Error('No Vite URL! The browser setup did not complete.');
			}

			// `/@fs/` requires posix-style absolute paths, even on Windows.
			const testerPath = path.join(testsDir, 'tester.ts').replaceAll('\\', '/');
			const testerUrl = `${viteUrl.replace(/\/$/, '')}/@fs/${testerPath}`;

			const page = this.getPage();
			await page.evaluate(
				async ([url, config]) => {
					await import(/* @vite-ignore */ url);

					window.__foundry_vitest__.setup(config);
				},
				[testerUrl, request.context.config] as const,
			);

			isSetup = true;

			return {
				__vitest_worker_response__: true,
				type: 'started',
			};
		}

		if (requestType === 'run') {
			const page = this.getPage();

			const files = await page.evaluate(async (context) => {
				return await window.__foundry_vitest__.run(context);
			}, request.context);

			// @ts-expect-error - Accessing a vitest-internal method; there is no
			// public API for a custom pool to report run results yet.
			await vitest._testRun.collected(this.options.project, files);

			return {
				__vitest_worker_response__: true,
				type: 'testfileFinished',
			};
		}

		if (requestType === 'collect') {
			const page = this.getPage();
			const files = await page.evaluate(async (context) => {
				return await window.__foundry_vitest__.collect(context);
			}, request.context);

			vitest.state.collectFiles(this.options.project, files);

			return {
				__vitest_worker_response__: true,
				type: 'testfileFinished',
			};
		}

		if (requestType === 'cancel' || requestType === 'stop') {
			return {
				__vitest_worker_response__: true,
				type: 'stopped',
			};
		}

		throw new Error(`Unexpected request type ${requestType satisfies never as string}`);
	}

	events = new EventEmitter();

	on(event: string, callback: (arg: unknown) => void): void {
		if (event === 'error' || event === 'exit' || event === 'message') {
			this.events.on(event, callback);
		} else {
			throw new Error(`Unexpected event ${event}. This is a bug in the integration pool.`);
		}
	}

	off(event: string, callback: (arg: unknown) => void): void {
		if (event === 'error' || event === 'exit' || event === 'message') {
			this.events.off(event, callback);
		} else {
			throw new Error(`Unexpected event ${event}. This is a bug in the integration pool.`);
		}
	}

	getPage() {
		if (browserData == null) {
			throw new Error('Could not get the page! The browser setup did not complete.');
		}

		return browserData.page;
	}

	async start() {
		if (browserData != null) {
			return;
		}

		// Vitest hard-caps runner start at 5s (WORKER_START_TIMEOUT), far less
		// than browser launch + world join. Don't await setup here; the first
		// request awaits it in `doRequest` instead.
		void setupBrowser(this.options.project.vitest).catch((e) => {
			// Workaround for https://github.com/vitest-dev/vitest/issues/9207
			console.error(e);
		});
	}

	async stop() {}

	canReuse() {
		// All workers are fungible and shell off to the same browser page,
		// so this worker can always be reused.
		return true;
	}

	deserialize(data: unknown) {
		return data;
	}
}

export const customPool = {
	name: 'foundry-browser-pool',
	createPoolWorker: (options: PoolOptions): PoolWorker => {
		return new FoundryBrowserWorker(options);
	},
};
