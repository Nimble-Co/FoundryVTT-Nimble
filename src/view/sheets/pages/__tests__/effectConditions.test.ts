import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { effectConditionOptions, toggledStatus } from '../effectConditions.ts';

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
		},
	};
	config.statusEffects = [
		{ id: 'prone', name: 'Prone', img: 'icons/prone.svg' },
		{ id: 'blinded', name: 'Blinded', img: 'icons/blinded.svg' },
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
});

describe('toggledStatus', () => {
	it('adds a status that is not there, and takes away one that is', () => {
		expect(toggledStatus(new Set(['prone']), 'blinded')).toEqual(['prone', 'blinded']);
		expect(toggledStatus(['prone', 'blinded'], 'prone')).toEqual(['blinded']);
	});
});
