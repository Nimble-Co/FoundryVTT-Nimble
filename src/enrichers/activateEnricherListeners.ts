import type { SaveKeyType } from '#types/saveKey.d.ts';
import type { NimbleBaseActor } from '../documents/actor/base.svelte.js';
import localize from '../utils/localize.js';

async function rollSavingThrowForSelectedTokens(saveKey: SaveKeyType) {
	const actors = (canvas?.tokens?.controlled ?? [])
		.map((token) => token.actor as NimbleBaseActor | null)
		.filter((actor) => actor !== null);

	if (!actors.length) {
		ui.notifications?.warn(localize('NIMBLE.savingThrowEnricher.noTokensSelected'));
		return;
	}

	for (const actor of actors) await actor.rollSavingThrowToChat(saveKey);
}

function onClick(event: MouseEvent) {
	const button = (event.target as Element | null)?.closest<HTMLButtonElement>(
		'button[data-enricher-type="savingthrow"]',
	);
	const saveKey = button?.dataset.saveKey as SaveKeyType | undefined;
	if (!saveKey) return;

	event.preventDefault();
	void rollSavingThrowForSelectedTokens(saveKey);
}

export default function activateEnricherListeners() {
	document.body.addEventListener('click', onClick);
	(Hooks.on as (event: string, fn: (id: string, win: Window) => void) => number)(
		'openDetachedWindow',
		(_id, win) => win.document.body.addEventListener('click', onClick),
	);
}
