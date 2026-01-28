/**
 * Vite HMR (Hot Module Replacement) support for FoundryVTT development.
 *
 * When running through Vite's dev server (port 30001), this module injects
 * the Vite HMR client which enables hot reloading of modules without full
 * page refreshes.
 *
 * In production builds, this module does nothing.
 */

const VITE_DEV_PORT = '30001';

/**
 * Check if we're running through Vite's dev server
 */
export function isViteDevServer(): boolean {
	return window.location.port === VITE_DEV_PORT;
}

/**
 * Inject the Vite HMR client script into the page.
 * This enables hot module replacement when running through the Vite dev server.
 */
export function injectViteHmrClient(): void {
	if (!isViteDevServer()) {
		return;
	}

	// Check if the Vite client is already loaded
	const existingScript = document.querySelector('script[src*="@vite/client"]');
	if (existingScript) {
		console.log('[Nimble] Vite HMR client already loaded');
		return;
	}

	// Create and inject the Vite client script
	const script = document.createElement('script');
	script.type = 'module';
	script.src = '/@vite/client';

	// Insert at the beginning of head to load as early as possible
	document.head.insertBefore(script, document.head.firstChild);

	console.log('[Nimble] Vite HMR client injected - hot reload enabled');
}

/**
 * Accept HMR updates for this module.
 * Call this to enable hot reloading for specific modules.
 */
export function acceptHmrUpdate(module: ImportMeta): void {
	if (!isViteDevServer()) {
		return;
	}

	if (module.hot) {
		module.hot.accept();
	}
}
