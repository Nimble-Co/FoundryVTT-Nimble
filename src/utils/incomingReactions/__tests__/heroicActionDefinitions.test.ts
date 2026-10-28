import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
	BUILT_IN_HEROIC_ACTIONS,
	BUILT_IN_HEROIC_REACTIONS,
	HEROIC_REACTIONS,
} from '../heroicActions.js';

const lang = JSON.parse(readFileSync(join(process.cwd(), 'public/lang/en.json'), 'utf-8'));

function hasLangKey(key: string): boolean {
	return typeof foundry.utils.getProperty(lang, key) === 'string';
}

describe('built-in heroic action definitions', () => {
	it('keeps the action id that each built-in hotbar macro calls', () => {
		expect(BUILT_IN_HEROIC_ACTIONS.map((action) => action.actionId)).toEqual([
			'attack',
			'unarmedStrike',
			'spell',
			'move',
			'assess',
		]);
		expect(BUILT_IN_HEROIC_REACTIONS.map((reaction) => reaction.actionId)).toEqual([
			'defend',
			'interpose',
			'opportunity',
			'help',
		]);
	});

	it('gives each definition the action type that its macro passes', () => {
		expect(BUILT_IN_HEROIC_ACTIONS.every((action) => action.actionType === 'action')).toBe(true);
		expect(BUILT_IN_HEROIC_REACTIONS.every((reaction) => reaction.actionType === 'reaction')).toBe(
			true,
		);
	});

	it('links each reaction to exactly one combatant reaction key', () => {
		expect(BUILT_IN_HEROIC_REACTIONS.map((reaction) => reaction.reactionKey).sort()).toEqual(
			[...HEROIC_REACTIONS].sort(),
		);
	});

	it('uses label and description keys that exist in the lang file', () => {
		for (const definition of [...BUILT_IN_HEROIC_ACTIONS, ...BUILT_IN_HEROIC_REACTIONS]) {
			expect(hasLangKey(definition.labelKey), definition.labelKey).toBe(true);
			expect(hasLangKey(definition.descriptionKey), definition.descriptionKey).toBe(true);
		}
	});
});
