import { afterEach, describe, expect, it, vi } from 'vitest';

import { getCombatantImage } from './combatantImage.js';

describe('getCombatantImage', () => {
	const baseGame = game;

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	function stubTokenizerModulesActive(tokenizer: boolean, vtta: boolean): void {
		const map = new Map([
			['tokenizer', { active: tokenizer }],
			['vtta-tokenizer', { active: vtta }],
		]);
		vi.stubGlobal('game', {
			...baseGame,
			modules: {
				get: (id: string) => map.get(id),
			},
		});
	}

	it('returns token texture when it is a normal path', () => {
		stubTokenizerModulesActive(false, false);
		const combatant = {
			token: { texture: { src: 'systems/nimble/foo.webp' } },
		} as Combatant.Implementation;

		expect(getCombatantImage(combatant)).toBe('systems/nimble/foo.webp');
	});

	it('skips tokenizer path when tokenizer modules are inactive', () => {
		stubTokenizerModulesActive(false, false);
		const combatant = {
			token: { texture: { src: 'tokenizer/pc-images/chase.Token.webp' } },
			img: 'icons/svg/mystery-man.svg',
		} as Combatant.Implementation;

		expect(getCombatantImage(combatant)).toBe('icons/svg/mystery-man.svg');
	});

	it('keeps tokenizer path when tokenizer module is active', () => {
		stubTokenizerModulesActive(true, false);
		const combatant = {
			token: { texture: { src: 'tokenizer/pc-images/chase.Token.webp' } },
		} as Combatant.Implementation;

		expect(getCombatantImage(combatant)).toBe('tokenizer/pc-images/chase.Token.webp');
	});

	it('falls through to actor portrait when token and combatant images are tokenizer paths', () => {
		stubTokenizerModulesActive(false, false);
		const combatant = {
			token: { texture: { src: 'tokenizer/pc-images/x.Token.webp' } },
			img: 'tokenizer/pc-images/x.Token.webp',
			actor: { img: 'icons/svg/cowled.svg' },
		} as Combatant.Implementation;

		expect(getCombatantImage(combatant, { includeActorImage: true })).toBe('icons/svg/cowled.svg');
	});
});
