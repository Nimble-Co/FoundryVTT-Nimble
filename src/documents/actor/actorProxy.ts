import { NimbleBaseActor } from './base.svelte';

/** A `Proxy` to to get Foundry to construct `NimbleActor` subclasses */
export default new Proxy(NimbleBaseActor, {
	construct(_target, args) {
		const ActorClass = CONFIG.NIMBLE.Actor.documentClasses[args[0].type] ?? NimbleBaseActor;
		return new ActorClass(...args);
	},
});
