import { describe, expect, it } from 'vitest';
import {
	createCombatActorFixture,
	createCombatantFixture,
} from '../../../../tests/fixtures/combat.js';
import { resolveMinimizedTrackerSummary } from './minimized.utils.js';

function createCharacterCombatant(options: { name?: string } = {}) {
	return createCombatantFixture({
		id: options.name ?? 'grak',
		type: 'character',
		actor: createCombatActorFixture({ type: 'character' }),
		actionsCurrent: 2,
		actionsMax: 3,
	});
}

describe('resolveMinimizedTrackerSummary', () => {
	it('reports the round and the combatant taking its turn', () => {
		const summary = resolveMinimizedTrackerSummary({
			combatStarted: true,
			roundLabel: 3,
			activeCombatant: createCharacterCombatant(),
		});

		expect(summary).toMatchObject({
			roundLabel: 3,
			hasActiveCombatant: true,
			actions: { current: 2, max: 3 },
		});
		expect(summary.portraitSrc).toBeTruthy();
		expect(summary.combatantName).toBeTruthy();
	});

	it('reports no active combatant before combat starts', () => {
		const summary = resolveMinimizedTrackerSummary({
			combatStarted: false,
			roundLabel: 1,
			activeCombatant: createCharacterCombatant(),
		});

		expect(summary).toMatchObject({
			roundLabel: 1,
			hasActiveCombatant: false,
			combatantName: null,
			portraitSrc: null,
			actions: null,
		});
	});

	it('reports no active combatant when the combat has none', () => {
		const summary = resolveMinimizedTrackerSummary({
			combatStarted: true,
			roundLabel: 2,
			activeCombatant: null,
		});

		expect(summary).toMatchObject({
			hasActiveCombatant: false,
			combatantName: null,
			portraitSrc: null,
			actions: null,
		});
	});

	it('floors fractional action counts so the strip never shows a partial action', () => {
		const combatant = createCombatantFixture({
			type: 'character',
			actor: createCombatActorFixture({ type: 'character' }),
			actionsCurrent: 1.7,
			actionsMax: 3.2,
		});

		const summary = resolveMinimizedTrackerSummary({
			combatStarted: true,
			roundLabel: 1,
			activeCombatant: combatant,
		});

		expect(summary.actions).toEqual({ current: 1, max: 3 });
	});
});
