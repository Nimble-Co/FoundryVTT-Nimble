import { cleanup } from '@testing-library/svelte';
import { readFileSync } from 'fs';
import { join } from 'path';
import { afterEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

import {
	configStructure,
	createGameMock,
	foundryApiMocks,
	globalFoundryMocks,
} from './mocks/foundry';

// Mock Foundry global object required setup before importing config
// CRITICAL: These document classes must be mocked BEFORE any code tries to extend them
// They are global Foundry classes, not part of the foundry object
Object.assign(globalThis, globalFoundryMocks);

// Mock foundry object for utilities and APIs
(globalThis as any).foundry = foundryApiMocks;

// Load language file for i18n localization
const langData = JSON.parse(readFileSync(join(process.cwd(), 'public/lang/en.json'), 'utf-8'));

// Mock Foundry game object with localization functionality
(globalThis as any).game = createGameMock(langData);

// Initialize CONFIG with required properties before calling init()
(globalThis as any).CONFIG = configStructure;

// Import and call init() to set up CONFIG.NIMBLE and other config
const init = (await import('../src/hooks/init')).default;
init();

// Import and call i18nInit() to translate all CONFIG.NIMBLE strings
const i18nInit = (await import('../src/hooks/i18nInit')).default;
i18nInit();

// Cleanup after each test
afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});
