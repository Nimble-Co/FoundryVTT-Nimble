import { vi } from 'vitest';

/**
 * Test fixtures for dialog-related data
 * These provide mock dialog objects for testing
 */

export function createMockDialog() {
	return {
		submit: vi.fn(),
		close: vi.fn(),
	};
}
