import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import {
	DEFAULT_PRIMARY_DIE_COLOR,
	DEFAULT_PRIMARY_DIE_LABEL_COLOR,
	DSN_PRIMARY_DIE_COLOR_SETTING_KEY,
	DSN_PRIMARY_DIE_LABEL_COLOR_SETTING_KEY,
	DSN_PRIMARY_DIE_STYLE_ENABLED_SETTING_KEY,
} from '../settings/diceSoNiceSettings.js';
import { getPrimaryDieDiceOptions, PRIMARY_DIE_COLORSET } from './diceSoNiceIntegration.js';

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
