import { vi } from 'vitest';
import type GenericDialog from '#documents/dialogs/GenericDialog.svelte.js';

/**
 * Test fixtures for dialog-related data
 * These provide mock dialog objects for testing
 */

export function createMockDialog(): GenericDialog {
	return {
		submit: vi.fn(),
		close: vi.fn(),
	} as unknown as GenericDialog;
}
