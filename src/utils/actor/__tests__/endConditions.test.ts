import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EndConditionsNode } from '#types/effectTree.js';
import { AUTOMATION_SETTING_KEYS } from '../../../settings/automationSettings.js';
import { effectsToEnd } from '../endConditions.js';

interface TestEffect {
	id: string;
	statuses: Set<string>;
	disabled?: boolean;
}

function holder(...effects: TestEffect[]) {
	return {
		effects,
		statuses: new Set(effects.filter((effect) => !effect.disabled).flatMap((e) => [...e.statuses])),
	};
}

const effect = (id: string, ...statuses: string[]): TestEffect => ({
	id,
	statuses: new Set(statuses),
});

function step(fields: Partial<EndConditionsNode> = {}): EndConditionsNode {
	return {
		id: 'end',
		type: 'endConditions',
		recipient: 'self',
		which: 'negative',
		conditions: [],
		parentContext: null,
		parentNode: null,
		...fields,
	};
}

const ids = (effects: { id: string }[]) => effects.map((entry) => entry.id);

let negative: Set<string>;

beforeEach(() => {
	const nimble = CONFIG.NIMBLE as unknown as { conditionNegativeConditions: Set<string> };
	negative = nimble.conditionNegativeConditions;
	nimble.conditionNegativeConditions = new Set([...negative, 'hexed']);
});

afterEach(() => {
	(
		CONFIG.NIMBLE as unknown as { conditionNegativeConditions: Set<string> }
	).conditionNegativeConditions = negative;
});

describe('effectsToEnd', () => {
	it('ends each effect with a negative condition, the whole effect, and keeps the others', () => {
		const actor = holder(
			effect('dazed', 'dazed'),
			effect('fumes', 'poisoned'),
			effect('focus', 'concentration'),
			effect('bloodied', 'bloodied'),
			effect('unseen', 'invisible'),
			effect('speed'),
		);

		expect(ids(effectsToEnd(actor, step()))).toEqual(['dazed', 'fumes']);
	});

	it('ends Grappled and Swallowed, and never Wounds or Dying', () => {
		const actor = holder(
			effect('grab', 'grappled'),
			effect('gulp', 'swallowed'),
			effect('wound', 'wounded'),
			effect('dying', 'dying'),
		);

		expect(ids(effectsToEnd(actor, step()))).toEqual(['grab', 'gulp']);
		expect(
			ids(effectsToEnd(actor, step({ which: 'listed', conditions: ['wounded', 'dying'] }))),
		).toEqual([]);
	});

	it('leaves a Hampered that Dazed gives to go with Dazed, and ends a Hampered set by hand', () => {
		const dazed = holder(effect('dazed', 'dazed'), effect('slow', 'hampered'));
		expect(ids(effectsToEnd(dazed, step()))).toEqual(['dazed']);

		const terrain = holder(effect('mud', 'hampered'));
		expect(ids(effectsToEnd(terrain, step()))).toEqual(['mud']);
	});

	it('ends a Hampered beside Dazed when Linked Conditions is off, as nothing else removes it', () => {
		const stub = game as unknown as { settings: unknown };
		const settings = stub.settings;
		stub.settings = {
			get: vi.fn(
				(_scope: string, key: string) => key !== AUTOMATION_SETTING_KEYS.derivedConditions,
			),
		};
		try {
			const actor = holder(effect('dazed', 'dazed'), effect('mud', 'hampered'));
			expect(ids(effectsToEnd(actor, step()))).toEqual(['dazed', 'mud']);
		} finally {
			stub.settings = settings;
		}
	});

	it('ends only the listed conditions, and a status that counts as one of them', () => {
		const actor = holder(
			effect('dazed', 'dazed'),
			effect('stun', 'stunned'),
			effect('fumes', 'poisoned'),
		);

		expect(
			ids(
				effectsToEnd(actor, step({ which: 'listed', conditions: ['incapacitated', 'poisoned'] })),
			),
		).toEqual(['stun', 'fumes']);
	});

	it('reads "counts as" one way: listing Stunned does not end an effect with only Incapacitated', () => {
		const actor = holder(effect('down', 'incapacitated'), effect('stun', 'stunned'));

		expect(ids(effectsToEnd(actor, step({ which: 'listed', conditions: ['stunned'] })))).toEqual([
			'stun',
		]);
		expect(
			ids(effectsToEnd(actor, step({ which: 'listed', conditions: ['incapacitated'] }))),
		).toEqual(['down', 'stun']);
	});

	it('keeps a Stunned effect when the list names Paralyzed or Restrained', () => {
		const actor = holder(effect('stun', 'stunned'));

		expect(ids(effectsToEnd(actor, step({ which: 'listed', conditions: ['paralyzed'] })))).toEqual(
			[],
		);
		expect(ids(effectsToEnd(actor, step({ which: 'listed', conditions: ['restrained'] })))).toEqual(
			[],
		);
	});

	it('reads a custom condition marked negative, and skips an effect that is off', () => {
		const off = { ...effect('old', 'poisoned'), disabled: true };
		const actor = holder(effect('hex', 'hexed'), off);

		expect(ids(effectsToEnd(actor, step()))).toEqual(['hex']);
	});
});
