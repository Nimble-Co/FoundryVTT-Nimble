/**
 * Test fixture: 15-rule item for the rules-builder perf smoke test.
 *
 * Used to verify that editing a single field in one rule doesn't cascade
 * into per-keystroke re-renders across the other 14. The manual procedure:
 *
 * 1. Open a Foundry world with a development build of the system.
 * 2. Create or import an item from this fixture (paste into a new feature
 *    or ancestry's `system.rules`).
 * 3. Open the rules tab. With browser devtools' performance panel
 *    recording, type a character into one rule's `label` input.
 * 4. Confirm the keystroke-to-paint latency stays under ~50ms and that
 *    the rendered DOM update is scoped to the single edited card.
 *
 * If latency regresses, the most likely cause is the per-card `$state`
 * boundary leaking — every input change should flow through one
 * `manager.updateRule(id, ...)` call that only re-derives the affected
 * card's reactive subtree.
 */

import type { RawPredicate } from '../../src/etc/Predicate.js';

interface RuleFixture {
	id: string;
	type: string;
	label: string;
	disabled: boolean;
	identifier: string;
	priority: number;
	predicate: RawPredicate;
	[key: string]: unknown;
}

function rule(
	id: string,
	type: string,
	label: string,
	extras: Record<string, unknown>,
): RuleFixture {
	return {
		id,
		type,
		label,
		disabled: false,
		identifier: '',
		priority: 1,
		predicate: {},
		...extras,
	};
}

export const fifteenRulesItemSource = {
	name: 'Perf Smoke: 15 Rules',
	type: 'feature',
	system: {
		identifier: 'perf-smoke-15',
		description: '<p>Used by the rules-builder perf smoke test.</p>',
		rules: [
			rule('p1', 'abilityBonus', 'Strength +1', { value: '1', abilities: ['strength'] }),
			rule('p2', 'abilityBonus', 'All +1', { value: '1', abilities: ['all'] }),
			rule('p3', 'armorClass', 'Plate', { formula: '2', mode: 'add' }),
			rule('p4', 'damageBonus', 'Fire melee', {
				value: '@level',
				damageType: 'fire',
				delivery: 'melee',
				source: 'any',
			}),
			rule('p5', 'damageBonus', 'Spell weapon', {
				value: '1d4',
				damageType: '',
				delivery: 'any',
				source: 'spell',
			}),
			rule('p6', 'maxHpBonus', 'Toughness', { value: 2, perLevel: true }),
			rule('p7', 'maxWounds', 'Stout', { value: '1' }),
			rule('p8', 'speedBonus', 'Lithe', { value: '1', movementType: null }),
			rule('p9', 'speedBonus', 'Fly', { value: '4', movementType: 'fly' }),
			rule('p10', 'skillBonus', 'Arcana +2', { value: '2', skills: ['arcana'] }),
			rule('p11', 'savingThrowBonus', 'Dex saves', { value: '1', savingThrows: ['dexterity'] }),
			rule('p12', 'initiativeBonus', 'Quickness', { value: '@dexterity.mod' }),
			rule('p13', 'conditionImmunity', 'Resilient', { conditions: ['frightened', 'charmed'] }),
			rule('p14', 'note', 'GM reminder', {
				description: '<p>Reminder for the GM only.</p>',
				target: [],
				title: 'GM',
				visibility: 'gmOnly',
			}),
			rule('p15', 'incrementHitDice', 'Tough HD', { value: '1' }),
		],
	},
} as const;
