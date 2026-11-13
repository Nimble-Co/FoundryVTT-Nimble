import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import activeEffectDataModels from '../activeEffectDataModels.js';
import {
	CLOCKS,
	ESCAPE_SAVES,
	EVENT_SUBJECTS,
	LASTS_UNTIL_EVENTS,
	LASTS_UNTIL_KINDS,
	LEGACY_CONDITION_EFFECT_TYPE,
	NIMBLE_EFFECT_TYPE,
	TIME_UNITS,
	TURN_BOUNDARIES,
	TURN_SPANS,
} from '../nimbleEffectChoices.js';
import { NimbleEffectData } from '../nimbleEffectDataModel.js';

interface Field {
	options: {
		required?: boolean;
		nullable?: boolean;
		blank?: boolean;
		initial?: unknown;
		choices?: string[];
		integer?: boolean;
		min?: number;
	};
	element?: Field;
	fields?: Record<string, Field>;
}

const fields = foundry.data.fields as unknown as Record<string, unknown>;
const hadAnyField = 'AnyField' in fields;

// The shared field mocks have no AnyField; the mirrored core `changes` schema needs one.
beforeAll(() => {
	if (!hadAnyField) {
		fields.AnyField = class AnyField {
			options: unknown;
			constructor(options?: unknown) {
				this.options = options ?? {};
			}
		};
	}
});

afterAll(() => {
	if (!hadAnyField) delete fields.AnyField;
});

function schema(): Record<string, Field> {
	return NimbleEffectData.defineSchema() as unknown as Record<string, Field>;
}

function readJson(path: string) {
	return JSON.parse(readFileSync(join(process.cwd(), path), 'utf-8'));
}

describe('Nimble effect data model', () => {
	it('keeps the core changes field that V14 verifies on every effect model', () => {
		const { changes } = schema();

		expect(Object.keys(changes.element?.fields ?? {})).toEqual([
			'key',
			'type',
			'value',
			'phase',
			'priority',
		]);
	});

	it('holds rules in the same shape as item rules', () => {
		const { rules } = schema();

		expect(rules.element?.options).toMatchObject({ required: true, nullable: false });
	});

	it('starts with no Lasts Until moments', () => {
		const { lastsUntil } = schema();

		expect(lastsUntil.options).toMatchObject({ required: true, nullable: false });
		expect((lastsUntil.options.initial as () => unknown)()).toEqual([]);
	});

	it('gives a moment its kind and the choices of each kind', () => {
		const moment = schema().lastsUntil.element?.fields ?? {};

		expect(moment.kind.options).toMatchObject({
			initial: 'turn',
			nullable: false,
			choices: [...LASTS_UNTIL_KINDS],
		});
		expect(moment.boundary.options.choices).toEqual([...TURN_BOUNDARIES]);
		expect(moment.clock.options.choices).toEqual([...CLOCKS]);
		expect(moment.span.options.choices).toEqual([...TURN_SPANS]);
		expect(moment.units.options.choices).toEqual([...TIME_UNITS]);
		expect(moment.who.options.choices).toEqual([...EVENT_SUBJECTS]);
		expect(moment.event.options.choices).toEqual([...LASTS_UNTIL_EVENTS]);
		expect(moment.value.options).toMatchObject({ integer: true, min: 1 });
	});

	it('leaves the fields of the other kinds empty', () => {
		const moment = schema().lastsUntil.element?.fields ?? {};

		for (const key of ['boundary', 'clock', 'span', 'value', 'units', 'who', 'event']) {
			expect(moment[key].options, key).toMatchObject({ nullable: true, initial: null });
		}
		expect(moment.effectName.options).toMatchObject({ nullable: false, initial: '' });
	});

	it('lists every event moment the spec names', () => {
		expect(LASTS_UNTIL_EVENTS).toEqual([
			'attack',
			'move',
			'castSpell',
			'takeDamage',
			'healed',
			'zeroHp',
			'die',
			'loseConcentration',
			'useAgain',
			'effectEnds',
			'nextRoll',
			'nextDamage',
			'nextSpell',
			'inactiveRound',
			'wounded',
			'chargeGained',
			'rest',
			'combatEnd',
			'gain',
			'applyEffect',
			'tempHpGone',
		]);
	});

	it('has no escape DC and the STR and DEX saves by default', () => {
		const escapeFields = schema().escape.fields ?? {};

		expect(escapeFields.dc.options).toMatchObject({ blank: true, initial: '' });
		const saves = escapeFields.saves as unknown as {
			options: { initial: () => string[] };
			element: { options: { choices: string[] } };
		};
		expect(saves.options.initial()).toEqual(['strength', 'dexterity']);
		expect(saves.element.options.choices).toEqual([...ESCAPE_SAVES]);
	});

	it('offers the save keys the system uses', () => {
		const saveKeys = Object.keys(CONFIG.NIMBLE.savingThrows);

		expect([...ESCAPE_SAVES]).toEqual(saveKeys);
	});

	it('gives change values a form input, like core', () => {
		const changeFields = (
			schema().changes as unknown as {
				element: { fields: Record<string, { options: Record<string, unknown> }> };
			}
		).element.fields;

		expect(changeFields.value.options.serializable).toBe(true);
		expect(() => (changeFields.type.options.validate as (type: string) => true)('x')).toThrow();
		expect((changeFields.type.options.validate as (type: string) => true)('add')).toBe(true);
	});

	it('records no temp HP and is not minor by default', () => {
		const { tempHp, minor } = schema();

		expect(tempHp.options).toMatchObject({ nullable: true, initial: null, integer: true, min: 0 });
		expect(minor.options).toMatchObject({ nullable: false, initial: false });
	});
});

describe('Nimble effect registration', () => {
	it('registers the Nimble type and keeps the legacy condition type loadable', () => {
		expect(activeEffectDataModels[NIMBLE_EFFECT_TYPE]).toBe(NimbleEffectData);
		expect(activeEffectDataModels[LEGACY_CONDITION_EFFECT_TYPE]).toBe(NimbleEffectData);
	});

	it('registers the models in CONFIG and makes the Nimble type the default', () => {
		const config = CONFIG.ActiveEffect as unknown as {
			dataModels: Record<string, unknown>;
			defaultType?: string;
		};

		expect(config.dataModels[NIMBLE_EFFECT_TYPE]).toBe(NimbleEffectData);
		expect(config.defaultType).toBe(NIMBLE_EFFECT_TYPE);
	});

	it('declares both types in the system manifest', () => {
		const manifest = readJson('public/system.json');

		expect(Object.keys(manifest.documentTypes.ActiveEffect).sort()).toEqual([
			LEGACY_CONDITION_EFFECT_TYPE,
			NIMBLE_EFFECT_TYPE,
		]);
	});

	it('has a type label for each type', () => {
		const lang = readJson('public/lang/en.json');

		expect(lang.TYPES.ActiveEffect[NIMBLE_EFFECT_TYPE]).toEqual(expect.any(String));
		expect(lang.TYPES.ActiveEffect[LEGACY_CONDITION_EFFECT_TYPE]).toEqual(expect.any(String));
	});
});
