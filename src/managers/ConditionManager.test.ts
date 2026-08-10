import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConditionManager } from './ConditionManager.js';

function setConfiguredConditions(
	conditions: Record<string, string>,
	relationships: {
		aliased?: Record<string, readonly string[]>;
		linked?: Record<string, readonly string[]>;
		stackable?: string[];
	} = {},
): void {
	(CONFIG as unknown as { NIMBLE: Record<string, unknown> }).NIMBLE = {
		conditions,
		conditionDefaultImages: Object.fromEntries(
			Object.keys(conditions).map((id) => [id, `icons/svg/${id}.svg`]),
		),
		conditionAliasedConditions: relationships.aliased ?? {},
		conditionLinkedConditions: relationships.linked ?? {},
		conditionStackableConditions: new Set<string>(relationships.stackable ?? []),
	};
}

describe('ConditionManager', () => {
	let manager: ConditionManager;

	beforeEach(() => {
		setConfiguredConditions({ blinded: 'Blinded', prone: 'Prone' });
		manager = new ConditionManager();
	});

	afterEach(() => {
		// The enrichHTML mock is shared infrastructure; restore its echoing default for
		// the tests that stub it, rather than leaking a stub into the next file.
		const enrichHTML = foundry.applications.ux.TextEditor.implementation
			.enrichHTML as unknown as ReturnType<typeof vi.fn>;
		enrichHTML.mockImplementation((html: string) => Promise.resolve(html));
		vi.restoreAllMocks();
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

		it('records aliases, linked statuses, and a static id for linked conditions', () => {
			setConfiguredConditions(
				{ blinded: 'Blinded', petrified: 'Petrified', wounded: 'Wounded' },
				{
					aliased: { blinded: ['dazed'] },
					linked: { petrified: ['incapacitated'] },
					stackable: ['wounded'],
				},
			);

			manager.initialize();

			expect(manager.get('blinded')?.aliases).toEqual(new Set(['dazed']));
			expect(manager.get('petrified')?.statuses).toEqual(['incapacitated']);
			// getMetadata() matches effects on this padded id, so its exact shape matters.
			expect(manager.get('petrified')?._id).toBe('petrified0000000');
			expect(manager.get('wounded')?.stackable).toBe(true);
		});

		it('leaves aliases, statuses, and the static id unset for plain conditions', () => {
			manager.initialize();

			const condition = manager.get('blinded');
			expect(condition?.aliases).toBeUndefined();
			expect(condition?.statuses).toBeUndefined();
			expect(condition?._id).toBeUndefined();
		});

		it('registers the raw enricher text then upgrades it once enrichment resolves', async () => {
			const enrichHTML = foundry.applications.ux.TextEditor.implementation
				.enrichHTML as unknown as ReturnType<typeof vi.fn>;
			enrichHTML.mockResolvedValue('<button>Blinded</button>');

			manager.initialize();

			expect(manager.get('blinded')?.enriched).toBe('[[/condition condition=blinded]]');

			await vi.waitFor(() =>
				expect(manager.get('blinded')?.enriched).toBe('<button>Blinded</button>'),
			);
		});

		it('keeps the raw enricher text when enrichment fails', async () => {
			const enrichHTML = foundry.applications.ux.TextEditor.implementation
				.enrichHTML as unknown as ReturnType<typeof vi.fn>;
			enrichHTML.mockRejectedValue(new Error('boom'));
			vi.spyOn(console, 'error').mockImplementation(() => undefined);

			expect(() => manager.initialize()).not.toThrow();

			await vi.waitFor(() => expect(console.error).toHaveBeenCalled());
			expect(manager.get('blinded')?.enriched).toBe('[[/condition condition=blinded]]');
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

		it('sorts the published snapshot by name rather than config order', () => {
			setConfiguredConditions({ zealous: 'Zealous', afraid: 'Afraid' });
			manager.initialize();
			manager.configureStatusEffects();

			expect(CONFIG.statusEffects.map((effect) => effect.id)).toEqual(['afraid', 'zealous']);
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
