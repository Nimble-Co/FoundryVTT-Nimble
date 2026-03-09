/**
 * wait-for-foundry.js
 * Reusable Playwright helper: wait for FoundryVTT to finish initializing.
 *
 * Usage in a Playwright test:
 *   await waitForFoundry(page);
 *
 * @param {import('@playwright/test').Page} page
 */
async function waitForFoundry(page) {
	// Wait for the loading overlay to disappear
	await page.waitForSelector('#loading', { state: 'hidden', timeout: 30000 });
	// Wait for network to settle after initialization
	await page.waitForLoadState('networkidle');
}

module.exports = { waitForFoundry };
