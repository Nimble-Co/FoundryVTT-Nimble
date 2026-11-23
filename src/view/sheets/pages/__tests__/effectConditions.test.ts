import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	conditionToggleUpdate,
	effectConditionOptions,
	toggledStatus,
} from '../effectConditions.ts';

const config = CONFIG as unknown as {
	NIMBLE: Record<string, unknown>;
	statusEffects: { id: string; name: string; img: string }[];
};
let saved: { nimble: unknown; status: unknown };

beforeEach(() => {
	saved = { nimble: config.NIMBLE, status: config.statusEffects };
	config.NIMBLE = {
		...(config.NIMBLE ?? {}),
		conditions: {
			prone: 'Prone',
			blinded: 'Blinded',
			concentration: 'Concentration',
			dying: 'Dying',
			latched: 'Latched',
			swallowed: 'Swallowed',
		},
		monsterConditions: new Set(['latched', 'swallowed']),
		conditionRules: {
			latched: [{ id: 'latchedAttacks', type: 'attackOutcome', cannotMiss: true }],
			swallowed: [
				{ id: 'swallowedDamage', type: 'turnDamage' },
				{ id: 'swallowedAttacks', type: 'attackOutcome' },
			],
		},
	};
	config.statusEffects = [
		{ id: 'prone', name: 'Prone', img: 'icons/prone.svg' },
		{ id: 'blinded', name: 'Blinded', img: 'icons/blinded.svg' },
		{ id: 'latched', name: 'Latched', img: 'icons/latched.svg' },
		{ id: 'swallowed', name: 'Swallowed', img: 'icons/swallowed.svg' },
	];
});

afterEach(() => {
	config.NIMBLE = saved.nimble as Record<string, unknown>;
	config.statusEffects = saved.status as typeof config.statusEffects;
});

describe('effectConditionOptions', () => {
	it('lists the conditions A to Z with their images, and not the states the system sets', () => {
		expect(effectConditionOptions()).toEqual([
			{ value: 'blinded', label: 'Blinded', icon: 'icons/blinded.svg' },
			{ value: 'prone', label: 'Prone', icon: 'icons/prone.svg' },
		]);
	});

	it('keeps a monster condition the effect already gives, so it can be seen and cleared', () => {
		expect(effectConditionOptions(new Set(['swallowed']))).toContainEqual({
			value: 'swallowed',
			label: 'Swallowed',
			icon: 'icons/swallowed.svg',
		});
	});
});

describe('toggledStatus', () => {
	it('adds a status that is not there, and takes away one that is', () => {
		expect(toggledStatus(new Set(['prone']), 'blinded')).toEqual(['prone', 'blinded']);
		expect(toggledStatus(['prone', 'blinded'], 'prone')).toEqual(['blinded']);
	});
});

describe('conditionToggleUpdate', () => {
	const rules = [
		{ id: 'latchedAttacks', type: 'attackOutcome', cannotMiss: true },
		{ id: 'authored', type: 'statBonus' },
	];

	it('drops the copied rules when the condition is cleared, and keeps the authored ones', () => {
		expect(conditionToggleUpdate(['latched'], 'latched', rules)).toEqual({
			statuses: [],
			'system.rules': [{ id: 'authored', type: 'statBonus' }],
		});
	});

	it('leaves the rules alone when the condition is added, or when it copies none', () => {
		expect(conditionToggleUpdate([], 'latched', rules)).toEqual({ statuses: ['latched'] });
		expect(conditionToggleUpdate(['blinded'], 'blinded', rules)).toEqual({ statuses: [] });
	});
});
