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
	MockRollConstructor,
	uiMock,
} from './mocks/foundry.js';

// Mock Foundry global object required setup before importing config
// CRITICAL: These document classes must be mocked BEFORE any code tries to extend them
// They are global Foundry classes, not part of the foundry object
Object.assign(globalThis, globalFoundryMocks);

// Mock the ui global for notifications
(globalThis as object as { ui: typeof uiMock }).ui = uiMock;

// Mock foundry object for utilities and APIs
// foundryApiMocks already includes a trackable Roll mock
(globalThis as object as { foundry: typeof foundryApiMocks }).foundry = foundryApiMocks;

// Also set Roll on globalThis for compatibility
(globalThis as object as { Roll: typeof foundryApiMocks.dice.Roll }).Roll =
	foundryApiMocks.dice.Roll;

// Store the constructor on globalThis so tests can reset the mock if needed
globalThis.__MockRollConstructor = MockRollConstructor;

// Load language file for i18n localization
const langData = JSON.parse(readFileSync(join(process.cwd(), 'public/lang/en.json'), 'utf-8'));

// Mock Foundry game object with localization functionality
(globalThis as object as { game: ReturnType<typeof createGameMock> }).game =
	createGameMock(langData);

// Initialize CONFIG with required properties before calling init()
(globalThis as object as { CONFIG: typeof configStructure }).CONFIG = configStructure;

// Import and call init() to set up CONFIG.NIMBLE and other config
const init = (await import('../src/hooks/init.js')).default;
init();

// Import and call i18nInit() to translate all CONFIG.NIMBLE strings
const i18nInit = (await import('../src/hooks/i18nInit.js')).default;
i18nInit();

// Cleanup after each test
afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});
