import type { NIMBLE } from '../src/config';
import type { NIMBLE_GAME } from '../src/game';

declare global {
	interface AssumeHookRan {
		init: never;
	}

	interface AssumeHookRan {
		setup: never;
	}

	interface AssumeHookRan {
		ready: never;
	}

	interface CONFIG {
		NIMBLE: typeof NIMBLE;
	}

	interface Game {
		nimble: typeof NIMBLE_GAME;
	}

	interface FlagConfig {
		Actor: {
			nimble: Record<string, unknown>;
		};
		Item: {
			nimble: Record<string, unknown>;
		};
		ChatMessage: {
			nimble: Record<string, unknown>;
		};
	}
}

export default (something = {});
