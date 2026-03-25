/**
 * Shared test helpers for accessing global test fixtures and handling async operations.
 */

/**
 * Returns the global test context typed as the specified type.
 * Used to access test fixtures that are set up on globalThis.
 */
export function getTestGlobals<T>(): T {
	return globalThis as unknown as T;
}

/**
 * Flushes the async task queue by waiting for a microtask to complete.
 * Useful for waiting for async hook callbacks to execute in tests.
 */
export async function flushAsync(): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, 0));
}
