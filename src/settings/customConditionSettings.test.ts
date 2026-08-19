import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConditionManager } from '../managers/ConditionManager.js';
import {
	DEFAULT_CUSTOM_CONDITION_ICON,
	getCustomConditions,
	isUnsafeConditionId,
	mergeCustomConditionsIntoConfig,
	sanitizeConditionId,
} from './customConditionSettings.js';

type SettingsMock = {
	get: ReturnType<typeof vi.fn>;
	set: ReturnType<typeof vi.fn>;
	register: ReturnType<typeof vi.fn>;
};

const BUILT_IN_CONDITIONS = { blinded: 'Blinded', prone: 'Prone' };
const BUILT_IN_DESCRIPTIONS = { blinded: 'You cannot see.', prone: 'You are on the ground.' };
const BUILT_IN_IMAGES = { blinded: 'icons/svg/blind.svg', prone: 'icons/svg/falling.svg' };

function setStoredConditions(settingsMock: SettingsMock, value: unknown): void {
	settingsMock.get.mockReturnValue(value);
}

function conditionConfig() {
	return CONFIG.NIMBLE as unknown as {
		conditions: Record<string, string>;
		conditionDescriptions: Record<string, string>;
		conditionDefaultImages: Record<string, string>;
	};
}

describe('customConditionSettings', () => {
	let settingsMock: SettingsMock;

	beforeEach(() => {
		settingsMock = { get: vi.fn(), set: vi.fn().mockResolvedValue(undefined), register: vi.fn() };
		(game as unknown as { settings: SettingsMock }).settings = settingsMock;
		(CONFIG as unknown as { NIMBLE: Record<string, unknown> }).NIMBLE = {
			conditions: { ...BUILT_IN_CONDITIONS },
			conditionDescriptions: { ...BUILT_IN_DESCRIPTIONS },
			conditionDefaultImages: { ...BUILT_IN_IMAGES },
		};
	});

	describe('sanitizeConditionId', () => {
		it('lowercases and converts to snake_case', () => {
			expect(sanitizeConditionId('Hexed')).toBe('hexed');
			expect(sanitizeConditionId('Soul Burned!')).toBe('soul_burned');
			expect(sanitizeConditionId('  Blood   Marked  ')).toBe('blood_marked');
		});

		it('returns empty string for blank or non-string input', () => {
			expect(sanitizeConditionId('   ')).toBe('');
			expect(sanitizeConditionId(42)).toBe('');
			expect(sanitizeConditionId(undefined)).toBe('');
		});
	});

	describe('isUnsafeConditionId', () => {
		it('rejects ids that collide with array indices or array properties', () => {
			expect(isUnsafeConditionId('13')).toBe(true);
			expect(isUnsafeConditionId('0')).toBe(true);
			expect(isUnsafeConditionId('length')).toBe(true);
			expect(isUnsafeConditionId('push')).toBe(true);
		});

		it('accepts ordinary condition ids', () => {
			expect(isUnsafeConditionId('hexed')).toBe(false);
			expect(isUnsafeConditionId('soul_burned')).toBe(false);
			expect(isUnsafeConditionId('c13')).toBe(false);
		});
	});

	describe('getCustomConditions', () => {
		it('returns an empty array when the setting is not an array', () => {
			setStoredConditions(settingsMock, undefined);
			expect(getCustomConditions()).toEqual([]);
		});

		it('drops malformed entries, built-in collisions, and duplicates', () => {
			setStoredConditions(settingsMock, [
				{ id: 'hexed', name: 'Hexed', description: 'Cursed by a hex.', img: 'icons/svg/hex.svg' },
				{ id: 'prone', name: 'Override Prone' }, // collides with built-in
				{ id: 'hexed', name: 'Duplicate' }, // duplicate id
				null, // malformed
				'not an object', // malformed
				{ name: 'No Id' }, // missing id
			]);

			expect(getCustomConditions()).toEqual([
				{ id: 'hexed', name: 'Hexed', description: 'Cursed by a hex.', img: 'icons/svg/hex.svg' },
			]);
		});

		it('drops ids that would corrupt CONFIG.statusEffects', () => {
			setStoredConditions(settingsMock, [
				{ id: '13', name: 'Numeric' },
				{ id: 'length', name: 'Length' },
				{ id: 'hexed', name: 'Hexed' },
			]);

			expect(getCustomConditions().map(({ id }) => id)).toEqual(['hexed']);
		});

		it('defaults name, description, and image when omitted', () => {
			setStoredConditions(settingsMock, [{ id: 'shaken' }]);
			expect(getCustomConditions()).toEqual([
				{ id: 'shaken', name: 'Shaken', description: '', img: DEFAULT_CUSTOM_CONDITION_ICON },
			]);
		});
	});

	describe('mergeCustomConditionsIntoConfig', () => {
		it('merges custom conditions alongside the built-in ones', () => {
			setStoredConditions(settingsMock, [
				{ id: 'hexed', name: 'Hexed', description: 'Cursed by a hex.', img: 'icons/svg/hex.svg' },
			]);

			mergeCustomConditionsIntoConfig();

			const config = conditionConfig();
			expect(config.conditions).toMatchObject({ blinded: 'Blinded', hexed: 'Hexed' });
			expect(config.conditionDescriptions.hexed).toBe('<p>Cursed by a hex.</p>');
			expect(config.conditionDefaultImages.hexed).toBe('icons/svg/hex.svg');
		});

		it('escapes markup in descriptions, which reach every player as tooltip HTML', () => {
			setStoredConditions(settingsMock, [
				{ id: 'hexed', name: 'Hexed', description: '<img src=x onerror=alert(1)>' },
			]);

			mergeCustomConditionsIntoConfig();

			expect(conditionConfig().conditionDescriptions.hexed).toBe(
				'<p>&lt;img src=x onerror=alert(1)&gt;</p>',
			);
		});

		it('keeps the GM line breaks as paragraphs and breaks', () => {
			setStoredConditions(settingsMock, [
				{ id: 'hexed', name: 'Hexed', description: 'First line.\nSecond line.\n\nNew paragraph.' },
			]);

			mergeCustomConditionsIntoConfig();

			expect(conditionConfig().conditionDescriptions.hexed).toBe(
				'<p>First line.<br>Second line.</p><p>New paragraph.</p>',
			);
		});

		it('is idempotent and removes conditions that are no longer stored', () => {
			setStoredConditions(settingsMock, [
				{ id: 'hexed', name: 'Hexed', description: 'x', img: 'icons/svg/hex.svg' },
			]);
			mergeCustomConditionsIntoConfig();

			setStoredConditions(settingsMock, []);
			mergeCustomConditionsIntoConfig();

			const config = conditionConfig();
			expect(config.conditions).not.toHaveProperty('hexed');
			expect(config.conditionDescriptions).not.toHaveProperty('hexed');
			expect(config.conditionDefaultImages).not.toHaveProperty('hexed');
			expect(Object.keys(config.conditions).sort()).toEqual(['blinded', 'prone']);
		});

		it('reaches CONFIG.statusEffects once the condition manager reinitializes', () => {
			// The GM-facing contract: a saved condition becomes a real Foundry status effect.
			// The merge and the manager are otherwise only tested in isolation.
			Object.assign(CONFIG.NIMBLE, {
				conditionAliasedConditions: {},
				conditionLinkedConditions: {},
				conditionStackableConditions: new Set<string>(),
			});
			// V14's CONFIG.statusEffects is mutated in place by the manager, so it must exist.
			(CONFIG as unknown as { statusEffects: unknown[] }).statusEffects = [];
			const manager = new ConditionManager();

			setStoredConditions(settingsMock, [
				{ id: 'hexed', name: 'Hexed', description: 'Cursed.', img: 'icons/svg/hex.svg' },
			]);
			mergeCustomConditionsIntoConfig();
			manager.initialize();
			manager.configureStatusEffects();

			expect(CONFIG.statusEffects).toContainEqual(
				expect.objectContaining({ id: 'hexed', name: 'Hexed', img: 'icons/svg/hex.svg' }),
			);

			setStoredConditions(settingsMock, []);
			mergeCustomConditionsIntoConfig();
			manager.initialize();
			manager.configureStatusEffects();

			expect(CONFIG.statusEffects.map((effect) => effect.id)).not.toContain('hexed');
		});

		it('does not cache a snapshot taken before CONFIG was populated', async () => {
			vi.resetModules();
			(CONFIG as unknown as { NIMBLE: Record<string, unknown> }).NIMBLE = {};

			const settings = await import('./customConditionSettings.js');
			expect(settings.getBuiltInConditionIds()).toEqual([]);

			// Caching the empty snapshot would make the next merge wipe the built-ins out of CONFIG.
			(CONFIG as unknown as { NIMBLE: Record<string, unknown> }).NIMBLE = {
				conditions: { ...BUILT_IN_CONDITIONS },
				conditionDescriptions: { ...BUILT_IN_DESCRIPTIONS },
				conditionDefaultImages: { ...BUILT_IN_IMAGES },
			};
			expect(settings.getBuiltInConditionIds()).toEqual(['blinded', 'prone']);
		});

		it('leaves entries a module added after the built-ins were captured alone', () => {
			setStoredConditions(settingsMock, [{ id: 'hexed', name: 'Hexed' }]);
			mergeCustomConditionsIntoConfig();

			// A module adding a condition at `setup` or `ready` lands after the built-in snapshot.
			// Rebuilding the dictionaries wholesale would drop it on the next save.
			const config = conditionConfig();
			config.conditions.moduleAdded = 'Module Added';
			config.conditionDescriptions.moduleAdded = '<p>From a module.</p>';
			config.conditionDefaultImages.moduleAdded = 'icons/svg/aura.svg';

			setStoredConditions(settingsMock, [{ id: 'shaken', name: 'Shaken' }]);
			mergeCustomConditionsIntoConfig();

			expect(config.conditions).toMatchObject({
				blinded: 'Blinded',
				moduleAdded: 'Module Added',
				shaken: 'Shaken',
			});
			expect(config.conditionDescriptions.moduleAdded).toBe('<p>From a module.</p>');
			expect(config.conditionDefaultImages.moduleAdded).toBe('icons/svg/aura.svg');
			expect(config.conditions).not.toHaveProperty('hexed');
		});

		it('bails instead of throwing when a dictionary is missing from CONFIG', () => {
			// A registration-order change can leave descriptions unpopulated; writing into it would
			// throw out of the merge with no way to recover.
			const config = conditionConfig() as unknown as Record<string, unknown>;
			delete config.conditionDescriptions;
			setStoredConditions(settingsMock, [{ id: 'hexed', name: 'Hexed' }]);

			expect(() => mergeCustomConditionsIntoConfig()).not.toThrow();
			expect(conditionConfig().conditions).not.toHaveProperty('hexed');
		});

		it('mutates the config dictionaries in place so existing references stay live', () => {
			const config = conditionConfig();
			const conditionsReference = config.conditions;

			setStoredConditions(settingsMock, [{ id: 'hexed', name: 'Hexed' }]);
			mergeCustomConditionsIntoConfig();

			expect(config.conditions).toBe(conditionsReference);
			expect(conditionsReference.hexed).toBe('Hexed');
		});
	});
});
