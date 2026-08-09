import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import {
	DEFAULT_PRIMARY_DIE_COLOR,
	DEFAULT_PRIMARY_DIE_LABEL_COLOR,
	DSN_PRIMARY_DIE_COLOR_SETTING_KEY,
	DSN_PRIMARY_DIE_LABEL_COLOR_SETTING_KEY,
	DSN_PRIMARY_DIE_STYLE_ENABLED_SETTING_KEY,
} from '../settings/diceSoNiceSettings.js';
import { getPrimaryDieAppearance, PRIMARY_DIE_COLORSET } from './diceSoNiceIntegration.js';

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

describe('getPrimaryDieAppearance', () => {
	beforeEach(() => {
		installSettingsMock({});
	});

	it('returns only the colorset when no settings are registered', () => {
		expect(getPrimaryDieAppearance()).toEqual({ colorset: PRIMARY_DIE_COLORSET });
	});

	it('returns undefined when the user has disabled primary die styling', () => {
		installSettingsMock({ [DSN_PRIMARY_DIE_STYLE_ENABLED_SETTING_KEY]: false });

		expect(getPrimaryDieAppearance()).toBeUndefined();
	});

	it('returns only the colorset when settings hold the default colors', () => {
		installSettingsMock({
			[DSN_PRIMARY_DIE_STYLE_ENABLED_SETTING_KEY]: true,
			[DSN_PRIMARY_DIE_COLOR_SETTING_KEY]: DEFAULT_PRIMARY_DIE_COLOR,
			[DSN_PRIMARY_DIE_LABEL_COLOR_SETTING_KEY]: DEFAULT_PRIMARY_DIE_LABEL_COLOR,
		});

		expect(getPrimaryDieAppearance()).toEqual({ colorset: PRIMARY_DIE_COLORSET });
	});

	it('includes a custom background with a matching edge', () => {
		installSettingsMock({ [DSN_PRIMARY_DIE_COLOR_SETTING_KEY]: '#123456' });

		expect(getPrimaryDieAppearance()).toEqual({
			colorset: PRIMARY_DIE_COLORSET,
			background: '#123456',
			edge: '#123456',
		});
	});

	it('includes a custom foreground without touching the background', () => {
		installSettingsMock({ [DSN_PRIMARY_DIE_LABEL_COLOR_SETTING_KEY]: '#ffffff' });

		expect(getPrimaryDieAppearance()).toEqual({
			colorset: PRIMARY_DIE_COLORSET,
			foreground: '#ffffff',
		});
	});

	it('expands three-digit hex colors', () => {
		installSettingsMock({ [DSN_PRIMARY_DIE_COLOR_SETTING_KEY]: '#a1c' });

		expect(getPrimaryDieAppearance()).toMatchObject({ background: '#aa11cc' });
	});

	it('stringifies Color-like setting values', () => {
		installSettingsMock({
			[DSN_PRIMARY_DIE_COLOR_SETTING_KEY]: { toString: () => '#654321' },
		});

		expect(getPrimaryDieAppearance()).toMatchObject({ background: '#654321' });
	});

	it('falls back to the default for invalid color values', () => {
		installSettingsMock({ [DSN_PRIMARY_DIE_COLOR_SETTING_KEY]: 'not-a-color' });

		expect(getPrimaryDieAppearance()).toEqual({ colorset: PRIMARY_DIE_COLORSET });
	});
});
