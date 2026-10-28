// The system code runs after the ready hook, so `game` and its members are always set.
export {};

declare global {
	interface AssumeHookRan {
		init: never;
		setup: never;
		ready: never;
	}
}
