import type { SaveKeyType } from '#types/saveKey.d.ts';
import type { NimbleBaseActor } from '../documents/actor/base.svelte.js';
import localize from '../utils/localize.js';

function rollSavingThrowForSelectedTokens(saveKey: SaveKeyType) {
	const actors = (canvas?.tokens?.controlled ?? [])
		.map((token) => token.actor as NimbleBaseActor | null)
		.filter((actor) => actor !== null);

	if (!actors.length) {
		ui.notifications?.warn(localize('NIMBLE.savingThrowEnricher.noTokensSelected'));
		return;
	}

	for (const actor of actors) actor.rollSavingThrowToChat(saveKey);
}

export default function activateEnricherListeners() {
	document.body.addEventListener('click', (event) => {
		const button = (event.target as Element | null)?.closest<HTMLButtonElement>(
			'button[data-enricher-type="savingthrow"]',
		);
		const saveKey = button?.dataset.saveKey as SaveKeyType | undefined;
		if (!saveKey) return;

		event.preventDefault();
		rollSavingThrowForSelectedTokens(saveKey);
	});
}
