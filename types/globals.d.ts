import type { NIMBLE } from '../src/config.js';
import type { NIMBLE_GAME } from '../src/game.js';

// Augment fvtt-types configuration for assumed hooks
declare module 'fvtt-types/configuration' {
	interface AssumeHookRan {
		init: never;
		setup: never;
		ready: never;
	}
}

// Augment global types
declare global {
	interface CONFIG {
		NIMBLE: typeof NIMBLE;
	}

	interface Game {
		nimble: typeof NIMBLE_GAME;
	}

	// Add missing DialogOptions type
	interface DialogOptions {
		title?: string;
		content?: string;
		buttons?: Record<string, DialogButton>;
		default?: string;
		close?: () => void;
		render?: (html: HTMLElement) => void;
	}

	interface DialogButton {
		icon?: string;
		label?: string;
		callback?: (html: HTMLElement) => void;
	}
}

export {};
