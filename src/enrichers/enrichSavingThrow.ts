import type { SaveKeyType } from '#types/saveKey.d.ts';
import localize from '../utils/localize.js';
import createEnricherButton from './createEnricherButton.js';

const SAVE_KEYS: Record<string, SaveKeyType> = {
	str: 'strength',
	strength: 'strength',
	dex: 'dexterity',
	dexterity: 'dexterity',
	int: 'intelligence',
	intelligence: 'intelligence',
	wil: 'will',
	will: 'will',
};

export default function enrichSavingThrow(
	args: Record<string, string | number>,
	_options?: foundry.applications.ux.TextEditor.EnrichmentOptions,
) {
	const { enricherType, save: saveArg, dc: dcArg } = args;
	if (!Object.hasOwn(SAVE_KEYS, String(saveArg))) return null;
	const saveKey = SAVE_KEYS[String(saveArg)];

	const dc = typeof dcArg === 'number' ? dcArg : undefined;
	const save = localize(CONFIG.NIMBLE.savingThrowAbbreviations[saveKey]).toLocaleUpperCase();
	const label =
		dc === undefined
			? localize('NIMBLE.savingThrowEnricher.label', { save })
			: localize('NIMBLE.savingThrowEnricher.labelWithDC', { save, dc: String(dc) });

	const tooltip = `
    <header class="nimble-tooltip__enricher-header">
      <h3 class="nimble-tooltip__enricher-heading">${label}</h3>
      <span class="nimble-tooltip__tag">${localize('NIMBLE.savingThrowEnricher.tag')}</span>
    </header>
    <p>${localize('NIMBLE.savingThrowEnricher.hint')}</p>
  `;

	const button = createEnricherButton(String(enricherType), {
		icon: 'fa-solid fa-dice-d20',
		label,
		tooltip,
	});
	button.dataset.saveKey = saveKey;

	return button;
}
