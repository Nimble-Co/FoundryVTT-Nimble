import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import {
	DEFAULT_PRIMARY_DIE_COLOR,
	DEFAULT_PRIMARY_DIE_LABEL_COLOR,
	DSN_PRIMARY_DIE_COLOR_SETTING_KEY,
	DSN_PRIMARY_DIE_LABEL_COLOR_SETTING_KEY,
	DSN_PRIMARY_DIE_STYLE_ENABLED_SETTING_KEY,
} from '../../settings/diceSoNiceSettings.js';
import { getPrimaryDieDiceOptions, PRIMARY_DIE_COLORSET, rollForDice3d } from '../diceSoNice.js';

type SettingsMock = {
	settings: { has: (id: string) => boolean };
	get: ReturnType<typeof vi.fn>;
};

function installSettingsMock(values: Record<string, unknown>): SettingsMock {
	const registeredIds = new Set(Object.keys(values).map((key) => `${SYSTEM_ID}.${key}`));
	const mock: SettingsMock = {
		settings: { has: (id: string) => registeredIds.has(id) },
		get: vi.fn((_namespace: string, key: string) => values[key]),
	};
	(game as unknown as { settings: SettingsMock }).settings = mock;
	return mock;
}

describe('getPrimaryDieDiceOptions', () => {
	beforeEach(() => {
		installSettingsMock({});
	});

	it('returns only the colorset when no settings are registered', () => {
		expect(getPrimaryDieDiceOptions()).toEqual({
			appearance: { colorset: PRIMARY_DIE_COLORSET },
			dsnDamageTypeManaged: true,
		});
	});

	it('returns undefined when the user has disabled primary die styling', () => {
		installSettingsMock({ [DSN_PRIMARY_DIE_STYLE_ENABLED_SETTING_KEY]: false });

		expect(getPrimaryDieDiceOptions()).toBeUndefined();
	});

	it('returns only the colorset when settings hold the default colors', () => {
		installSettingsMock({
			[DSN_PRIMARY_DIE_STYLE_ENABLED_SETTING_KEY]: true,
			[DSN_PRIMARY_DIE_COLOR_SETTING_KEY]: DEFAULT_PRIMARY_DIE_COLOR,
			[DSN_PRIMARY_DIE_LABEL_COLOR_SETTING_KEY]: DEFAULT_PRIMARY_DIE_LABEL_COLOR,
		});

		expect(getPrimaryDieDiceOptions()?.appearance).toEqual({ colorset: PRIMARY_DIE_COLORSET });
	});

	it('derives a matching edge and a darkened outline from a custom background', () => {
		installSettingsMock({ [DSN_PRIMARY_DIE_COLOR_SETTING_KEY]: '#123456' });

		expect(getPrimaryDieDiceOptions()?.appearance).toEqual({
			colorset: PRIMARY_DIE_COLORSET,
			background: '#123456',
			edge: '#123456',
			outline: '#06121e',
		});
	});

	it('includes a custom foreground without touching the background', () => {
		installSettingsMock({ [DSN_PRIMARY_DIE_LABEL_COLOR_SETTING_KEY]: '#ffffff' });

		expect(getPrimaryDieDiceOptions()?.appearance).toEqual({
			colorset: PRIMARY_DIE_COLORSET,
			foreground: '#ffffff',
		});
	});

	it('expands three-digit hex colors', () => {
		installSettingsMock({ [DSN_PRIMARY_DIE_COLOR_SETTING_KEY]: '#a1c' });

		expect(getPrimaryDieDiceOptions()?.appearance).toMatchObject({ background: '#aa11cc' });
	});

	it('stringifies Color-like setting values', () => {
		installSettingsMock({
			[DSN_PRIMARY_DIE_COLOR_SETTING_KEY]: { toString: () => '#654321' },
		});

		expect(getPrimaryDieDiceOptions()?.appearance).toMatchObject({ background: '#654321' });
	});

	it('falls back to the default for invalid color values', () => {
		installSettingsMock({ [DSN_PRIMARY_DIE_COLOR_SETTING_KEY]: 'not-a-color' });

		expect(getPrimaryDieDiceOptions()?.appearance).toEqual({ colorset: PRIMARY_DIE_COLORSET });
	});

	it('marks the damage type as system-managed so a flavor cannot override the colorset', () => {
		installSettingsMock({});

		expect(getPrimaryDieDiceOptions()?.dsnDamageTypeManaged).toBe(true);
	});
});

describe('rollForDice3d', () => {
	const result = (value: number, extra: object = {}) => ({ result: value, active: true, ...extra });
	const term = (results: object[], faces = 6) =>
		Object.assign(new foundry.dice.terms.Die({ number: 1, faces }), { results });

	it('gives no roll of its own when each die is the size of its term', () => {
		const roll = { dice: [term([result(6, { exploded: true }), result(2)])], total: 8 };

		expect(rollForDice3d(roll as never)).toBeNull();
	});

	it('throws a d20 crit die as a d20, after the die that started it', () => {
		const other = term([result(4)]);
		const roll = {
			dice: [term([result(6, { exploded: true }), result(13, { faces: 20 })]), other],
			total: 23,
		};

		const split = rollForDice3d(roll as never);

		expect(split?.total).toBe(23);
		expect(
			split?.dice.map((die) => [die.number, die.faces, die.results.map((each) => each.result)]),
		).toEqual([
			[1, 6, [6]],
			[0, 20, [13]],
			[1, 6, [4]],
		]);
	});

	it('throws the dice a 20 starts at the size of the weapon', () => {
		const roll = {
			dice: [
				term([result(6, { exploded: true }), result(20, { faces: 20, exploded: true }), result(3)]),
			],
			total: 29,
		};

		const split = rollForDice3d(roll as never);

		expect(
			split?.dice.map((die) => [die.number, die.faces, die.results.map((each) => each.result)]),
		).toEqual([
			[1, 6, [6]],
			[0, 20, [20]],
			[0, 6, [3]],
		]);
	});

	it('keeps the ghost and secret marks of the roll', () => {
		const roll = { dice: [term([result(13, { faces: 20 })])], total: 13, secret: true };

		expect(rollForDice3d(roll as never)).toMatchObject({ secret: true });
	});
});
