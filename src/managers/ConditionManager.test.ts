import { beforeEach, describe, expect, it } from 'vitest';
import { ConditionManager } from './ConditionManager.js';

function setConfiguredConditions(conditions: Record<string, string>): void {
	(CONFIG as unknown as { NIMBLE: Record<string, unknown> }).NIMBLE = {
		conditions,
		conditionDefaultImages: Object.fromEntries(
			Object.keys(conditions).map((id) => [id, `icons/svg/${id}.svg`]),
		),
		conditionAliasedConditions: {},
		conditionLinkedConditions: {},
		conditionStackableConditions: new Set<string>(),
	};
}

describe('ConditionManager', () => {
	let manager: ConditionManager;

	beforeEach(() => {
		setConfiguredConditions({ blinded: 'Blinded', prone: 'Prone' });
		manager = new ConditionManager();
	});

	describe('initialize', () => {
		it('registers every configured condition synchronously', () => {
			manager.initialize();

			expect(manager.get('blinded')).toMatchObject({
				id: 'blinded',
				name: 'Blinded',
				img: 'icons/svg/blinded.svg',
				stackable: false,
			});
			expect(manager.get('prone')?.name).toBe('Prone');
		});

		it('picks up conditions added to the config on a re-run', () => {
			manager.initialize();
			setConfiguredConditions({ blinded: 'Blinded', prone: 'Prone', hexed: 'Hexed' });

			manager.initialize();

			expect(manager.get('hexed')?.name).toBe('Hexed');
		});

		it('drops conditions removed from the config on a re-run', () => {
			setConfiguredConditions({ blinded: 'Blinded', hexed: 'Hexed' });
			manager.initialize();
			expect(manager.get('hexed')).toBeDefined();

			setConfiguredConditions({ blinded: 'Blinded' });
			manager.initialize();

			expect(manager.get('hexed')).toBeUndefined();
			expect(manager.getTagGroupData()).toEqual([{ label: 'Blinded', value: 'blinded' }]);
		});
	});

	describe('configureStatusEffects', () => {
		it('throws before initialize has run', () => {
			expect(() => manager.configureStatusEffects()).toThrow('Conditions are not ready yet.');
		});

		it('publishes the conditions registered by the immediately preceding initialize', () => {
			manager.initialize();
			manager.configureStatusEffects();

			expect(CONFIG.statusEffects.map((effect) => effect.id)).toEqual(['blinded', 'prone']);
		});

		it('re-publishes the snapshot after the config changes', () => {
			manager.initialize();
			manager.configureStatusEffects();

			setConfiguredConditions({ blinded: 'Blinded', hexed: 'Hexed' });
			manager.initialize();
			manager.configureStatusEffects();

			expect(CONFIG.statusEffects.map((effect) => effect.id)).toEqual(['blinded', 'hexed']);
		});
	});
});
