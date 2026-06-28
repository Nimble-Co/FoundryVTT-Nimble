import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	DEFAULT_CUSTOM_SCHOOL_ICON,
	getCustomSpellSchools,
	mergeCustomSpellSchoolsIntoConfig,
	sanitizeSpellSchoolKey,
} from './spellSchoolSettings.js';

type SettingsMock = {
	get: ReturnType<typeof vi.fn>;
	set: ReturnType<typeof vi.fn>;
	register: ReturnType<typeof vi.fn>;
};

const BUILT_IN_SCHOOLS = { fire: 'Fire', ice: 'Ice' };
const BUILT_IN_SCHOOL_ICONS = {
	fire: 'fa-solid fa-fire-flame-curved',
	ice: 'fa-solid fa-snowflake',
};

function setStoredSchools(settingsMock: SettingsMock, value: unknown): void {
	settingsMock.get.mockReturnValue(value);
}

describe('spellSchoolSettings', () => {
	let settingsMock: SettingsMock;

	beforeEach(() => {
		settingsMock = { get: vi.fn(), set: vi.fn().mockResolvedValue(undefined), register: vi.fn() };
		(game as unknown as { settings: SettingsMock }).settings = settingsMock;
		(CONFIG as unknown as { NIMBLE: Record<string, unknown> }).NIMBLE = {
			spellSchools: { ...BUILT_IN_SCHOOLS },
			spellSchoolIcons: { ...BUILT_IN_SCHOOL_ICONS },
		};
	});

	describe('sanitizeSpellSchoolKey', () => {
		it('lowercases and converts to snake_case', () => {
			expect(sanitizeSpellSchoolKey('Hexbinder')).toBe('hexbinder');
			expect(sanitizeSpellSchoolKey('Holy Fire!')).toBe('holy_fire');
			expect(sanitizeSpellSchoolKey('  Blood   Magic  ')).toBe('blood_magic');
		});

		it('returns empty string for blank or non-string input', () => {
			expect(sanitizeSpellSchoolKey('   ')).toBe('');
			expect(sanitizeSpellSchoolKey(42)).toBe('');
			expect(sanitizeSpellSchoolKey(undefined)).toBe('');
		});
	});

	describe('getCustomSpellSchools', () => {
		it('returns an empty array when the setting is not an array', () => {
			setStoredSchools(settingsMock, undefined);
			expect(getCustomSpellSchools()).toEqual([]);
		});

		it('drops malformed entries, built-in collisions, and duplicates', () => {
			setStoredSchools(settingsMock, [
				{ key: 'hexbinder', label: 'Hexbinder', icon: 'fa-solid fa-hand-sparkles' },
				{ key: 'fire', label: 'Override Fire' }, // collides with built-in
				{ key: 'hexbinder', label: 'Duplicate' }, // duplicate key
				null, // malformed
				'not an object', // malformed
				{ label: 'No Key' }, // missing key
			]);

			expect(getCustomSpellSchools()).toEqual([
				{ key: 'hexbinder', label: 'Hexbinder', icon: 'fa-solid fa-hand-sparkles' },
			]);
		});

		it('defaults label and icon when omitted', () => {
			setStoredSchools(settingsMock, [{ key: 'shadow' }]);
			expect(getCustomSpellSchools()).toEqual([
				{ key: 'shadow', label: 'Shadow', icon: DEFAULT_CUSTOM_SCHOOL_ICON },
			]);
		});
	});

	describe('mergeCustomSpellSchoolsIntoConfig', () => {
		it('merges custom schools alongside the built-in ones', () => {
			setStoredSchools(settingsMock, [
				{ key: 'hexbinder', label: 'Hexbinder', icon: 'fa-solid fa-hand-sparkles' },
			]);

			mergeCustomSpellSchoolsIntoConfig();

			const config = CONFIG.NIMBLE as unknown as {
				spellSchools: Record<string, string>;
				spellSchoolIcons: Record<string, string>;
			};
			expect(config.spellSchools).toMatchObject({ fire: 'Fire', hexbinder: 'Hexbinder' });
			expect(config.spellSchoolIcons.hexbinder).toBe('fa-solid fa-hand-sparkles');
		});

		it('is idempotent and removes schools that are no longer stored', () => {
			setStoredSchools(settingsMock, [{ key: 'hexbinder', label: 'Hexbinder', icon: 'x' }]);
			mergeCustomSpellSchoolsIntoConfig();

			setStoredSchools(settingsMock, []);
			mergeCustomSpellSchoolsIntoConfig();

			const config = CONFIG.NIMBLE as unknown as { spellSchools: Record<string, string> };
			expect(config.spellSchools).not.toHaveProperty('hexbinder');
			expect(Object.keys(config.spellSchools).sort()).toEqual(['fire', 'ice']);
		});
	});
});
