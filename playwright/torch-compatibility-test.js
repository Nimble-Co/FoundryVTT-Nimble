/**
 * Torch Module Compatibility Test
 * Tests torch-nimble.json accessibility and Torch module integration
 * Run: npx playwright test playwright/torch-compatibility-test.js --headed
 * Or:  node playwright/torch-compatibility-test.js (with @playwright/test runner)
 */

const { chromium } = require('playwright');

(async () => {
	const browser = await chromium.launch({ headless: false, slowMo: 200 });
	const context = await browser.newContext();
	const page = await context.newPage();

	const results = {
		torchActive: null,
		torchNimbleJsonAccessible: null,
		torchNimbleJsonContent: null,
		gameLightSourcesSetting: null,
		nimbleTorchLogMessages: [],
		consoleErrors: [],
		torchHudButtonVisible: null,
		modulesInstalled: [],
	};

	// Capture console messages
	page.on('console', (msg) => {
		const text = msg.text();
		if (msg.type() === 'error') {
			results.consoleErrors.push(text);
		}
		if (text.includes('Nimble | Torch') || text.includes('torch') || text.includes('Torch')) {
			results.nimbleTorchLogMessages.push(`[${msg.type()}] ${text}`);
		}
	});

	page.on('pageerror', (err) => {
		results.consoleErrors.push(`PAGE ERROR: ${err.message}`);
	});

	console.log('--- Step 1: Navigate to FoundryVTT ---');
	await page.goto('http://localhost:30000', { waitUntil: 'networkidle' });
	await page.screenshot({
		path: '/Users/carlosprieto/foundryVTT/FoundryVTT-Nimble/playwright/screenshots/torch-01-initial.png',
	});
	console.log('Current URL:', page.url());

	// If redirected to setup, we need to launch a world first
	if (page.url().includes('/setup')) {
		console.log('--- Step 2: At setup page, launching Midgard world ---');

		// Use the API to launch the world
		const launchResponse = await page.request.post('http://localhost:30000/api/setup', {
			headers: { 'Content-Type': 'application/json' },
			data: JSON.stringify({ action: 'launchWorld', world: 'midgard' }),
		});
		console.log('Launch world response status:', launchResponse.status());

		// Wait for the world to start
		await page.waitForTimeout(5000);
		await page.goto('http://localhost:30000', { waitUntil: 'networkidle', timeout: 30000 });
		await page.screenshot({
			path: '/Users/carlosprieto/foundryVTT/FoundryVTT-Nimble/playwright/screenshots/torch-02-after-launch.png',
		});
		console.log('URL after launch:', page.url());
	}

	// Handle login page
	if (page.url().includes('/join') || page.url().includes('/login')) {
		console.log('--- Step 3: Login as Gamemaster ---');
		await page.screenshot({
			path: '/Users/carlosprieto/foundryVTT/FoundryVTT-Nimble/playwright/screenshots/torch-03-login.png',
		});

		// Try selecting Gamemaster
		const gmOption = page.locator('option:has-text("Gamemaster"), option[value="gamemaster"]');
		if ((await gmOption.count()) > 0) {
			await page.locator('select[name="userid"]').selectOption({ label: 'Gamemaster' });
		}

		// Leave password blank and join
		const joinBtn = page.locator('button:has-text("Join"), button[type="submit"]');
		if ((await joinBtn.count()) > 0) {
			await joinBtn.first().click();
			await page.waitForLoadState('networkidle', { timeout: 30000 });
		}
		await page.screenshot({
			path: '/Users/carlosprieto/foundryVTT/FoundryVTT-Nimble/playwright/screenshots/torch-04-after-login.png',
		});
		console.log('URL after login:', page.url());
	}

	// Wait for FoundryVTT canvas/game to be ready
	console.log('--- Step 4: Waiting for game to initialize ---');
	try {
		await page.waitForFunction(() => typeof game !== 'undefined' && game.ready === true, {
			timeout: 60000,
			polling: 1000,
		});
		console.log('Game is ready');
	} catch (e) {
		console.log('Timeout waiting for game.ready:', e.message);
	}

	await page.screenshot({
		path: '/Users/carlosprieto/foundryVTT/FoundryVTT-Nimble/playwright/screenshots/torch-05-game-ready.png',
	});

	// Step 5: Check torch module active status
	console.log('--- Step 5: Check torch module status ---');
	results.torchActive = await page.evaluate(() => {
		if (typeof game === 'undefined') return 'game not defined';
		const mod = game.modules.get('torch');
		if (!mod) return 'module not found';
		return mod.active;
	});
	console.log('Torch active:', results.torchActive);

	// Step 6: Check installed modules
	results.modulesInstalled = await page.evaluate(() => {
		if (typeof game === 'undefined') return [];
		return Array.from(game.modules.values())
			.filter((m) => m.active)
			.map((m) => ({ id: m.id, title: m.title, version: m.version }));
	});
	console.log('Active modules:', JSON.stringify(results.modulesInstalled, null, 2));

	// Step 7: Check torch-nimble.json accessibility
	console.log('--- Step 6: Check torch-nimble.json file ---');
	const fetchResult = await page.evaluate(async () => {
		try {
			const resp = await fetch('/systems/nimble/torch-nimble.json');
			if (!resp.ok) return { ok: false, status: resp.status };
			const text = await resp.text();
			return { ok: true, status: resp.status, content: text };
		} catch (e) {
			return { ok: false, error: e.message };
		}
	});
	results.torchNimbleJsonAccessible = fetchResult.ok;
	results.torchNimbleJsonContent =
		fetchResult.content || fetchResult.error || `HTTP ${fetchResult.status}`;
	console.log('torch-nimble.json accessible:', fetchResult.ok);
	console.log('Content:', fetchResult.content || fetchResult.error);

	// Step 8: Check gameLightSources setting (only if torch is active)
	if (results.torchActive === true) {
		console.log('--- Step 7: Check gameLightSources setting ---');
		results.gameLightSourcesSetting = await page.evaluate(() => {
			try {
				return game.settings.get('torch', 'gameLightSources');
			} catch (e) {
				return `ERROR: ${e.message}`;
			}
		});
		console.log('gameLightSources:', results.gameLightSourcesSetting);
	} else {
		console.log('Torch not active — skipping gameLightSources check');
		results.gameLightSourcesSetting = 'N/A (torch not active)';
	}

	// Step 9: Final screenshot and report
	await page.screenshot({
		path: '/Users/carlosprieto/foundryVTT/FoundryVTT-Nimble/playwright/screenshots/torch-06-final.png',
		fullPage: false,
	});

	console.log('\n========== TORCH COMPATIBILITY TEST RESULTS ==========');
	console.log('Torch module active:', results.torchActive);
	console.log('torch-nimble.json accessible:', results.torchNimbleJsonAccessible);
	console.log('torch-nimble.json content:', results.torchNimbleJsonContent);
	console.log('gameLightSources setting:', results.gameLightSourcesSetting);
	console.log(
		'\nNimble|Torch log messages:',
		results.nimbleTorchLogMessages.length ? results.nimbleTorchLogMessages : ['(none)'],
	);
	console.log(
		'\nConsole errors:',
		results.consoleErrors.length ? results.consoleErrors : ['(none)'],
	);
	console.log(
		'\nActive modules:',
		results.modulesInstalled.map((m) => `${m.id} v${m.version}`).join(', ') || '(none)',
	);
	console.log('======================================================');

	await browser.close();
	process.exit(0);
})();
