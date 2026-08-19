import { describe, expect, it } from 'vitest';

import type { NimbleCharacter } from '#documents/actor/character.js';
import { generateInitialColumnContentHtml } from './generatePdfContent.ts';

const CONDUIT_OF_SHADOW_DESCRIPTION =
	'<p>Your Patron grants you knowledge of:</p>' +
	'<p>@UUID[Compendium.nimble.nimble-spells.Item.9TNPdOXlCcGgxw6r]{Shadow Blast}</p>' +
	'<p>@UUID[Compendium.nimble.nimble-spells.Item.ho2KADcmQWWTeYR0]{Summon Shadow}</p>';

function createCharacterWithFeature(description: string): NimbleCharacter {
	const feature = {
		id: 'conduitOfShadow01',
		type: 'feature',
		name: 'Conduit of Shadow',
		isType: (type: string) => type === 'feature',
		system: {
			description,
			class: 'shadowmancer',
			group: 'shadowmancer-progression',
			subclass: false,
			gainedAtLevel: 1,
			gainedAtLevels: [1],
		},
	};

	return {
		items: [feature],
		classes: {
			shadowmancer: {
				name: 'Shadowmancer',
				identifier: 'shadowmancer',
				system: { groupIdentifiers: ['shadowmancer-progression'] },
			},
		},
		system: {
			currency: { gp: { value: 0 }, sp: { value: 0 }, cp: { value: 0 } },
		},
	} as unknown as NimbleCharacter;
}

describe('generateInitialColumnContentHtml', () => {
	it('renders a feature description that links to spells with the spell names', () => {
		const columns = generateInitialColumnContentHtml(
			createCharacterWithFeature(CONDUIT_OF_SHADOW_DESCRIPTION),
		);
		const content = columns.join('');

		expect(content).toContain('Shadow Blast');
		expect(content).toContain('Summon Shadow');
		expect(content).not.toContain('@UUID');
		expect(content).not.toContain('9TNPdOXlCcGgxw6r');
		expect(content).not.toContain('ho2KADcmQWWTeYR0');
	});
});
