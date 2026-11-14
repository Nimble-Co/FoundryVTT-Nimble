import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import type { EffectNode } from '#types/effectTree.js';

const applyEffectFromCard = vi.fn(async (..._args: unknown[]) => {});
const giveWoundsFromCard = vi.fn(async (..._args: unknown[]) => {});
const endConditionsFromCard = vi.fn(async (..._args: unknown[]) => {});
let automation = true;

let applySelfEffectsOnUse: typeof import('../selfEffectsOnUse.js').applySelfEffectsOnUse;
let selfStepsOf: typeof import('../selfEffectsOnUse.js').selfStepsOf;

beforeEach(async () => {
	applyEffectFromCard.mockClear();
	giveWoundsFromCard.mockClear();
	endConditionsFromCard.mockClear();
	automation = true;
	vi.resetModules();
	vi.doMock('#utils/chat/applyEffectFromCard.js', async (importOriginal) => ({
		...(await importOriginal<object>()),
		applyEffectFromCard,
	}));
	vi.doMock('#utils/chat/woundFromCard.js', async (importOriginal) => ({
		...(await importOriginal<object>()),
		giveWoundsFromCard,
	}));
	vi.doMock('#utils/chat/endConditionsFromCard.js', async (importOriginal) => ({
		...(await importOriginal<object>()),
		endConditionsFromCard,
	}));
	vi.doMock('../../settings/automationSettings.js', async (importOriginal) => ({
		...(await importOriginal<object>()),
		isRuleAutomationEnabled: () => automation,
	}));
	({ applySelfEffectsOnUse, selfStepsOf } = await import('../selfEffectsOnUse.js'));
	vi.doUnmock('#utils/chat/applyEffectFromCard.js');
	vi.doUnmock('#utils/chat/woundFromCard.js');
	vi.doUnmock('#utils/chat/endConditionsFromCard.js');
	vi.doUnmock('../../settings/automationSettings.js');
});

function applyStep(
	id: string,
	recipient: 'self' | 'targets',
	parentContext: string | null = null,
): EffectNode {
	return {
		id,
		type: 'applyEffect',
		effectId: 'fx',
		recipient,
		parentContext,
		parentNode: parentContext ? 'damage' : null,
	};
}

/** An attack: a root self step, a root target step, and a self step under each outcome. */
function attackTree(): EffectNode[] {
	return [
		applyStep('rootSelf', 'self'),
		applyStep('rootTargets', 'targets'),
		{
			id: 'damage',
			type: 'damage',
			damageType: 'slashing',
			formula: '1d6',
			parentContext: null,
			parentNode: null,
			on: {
				hit: [applyStep('onHit', 'self', 'hit')],
				criticalHit: [applyStep('onCrit', 'self', 'criticalHit')],
				miss: [applyStep('onMiss', 'self', 'miss')],
			},
		},
	];
}

function card(outcome: { isCritical?: boolean; isMiss?: boolean } = {}, applied = {}) {
	return {
		id: 'message-1',
		flags: { [SYSTEM_ID]: { appliedEffects: applied } },
		system: { activation: { effects: attackTree() }, ...outcome },
		update: vi.fn(async () => undefined),
	};
}

const ids = (nodes: { id: string }[]) => nodes.map((node) => node.id);

describe('selfStepsOf', () => {
	it('gives the root self steps and the self steps under a hit', () => {
		expect(ids(selfStepsOf(card()))).toEqual(['rootSelf', 'onHit']);
	});

	it('gives the steps under a crit and under a hit for a crit', () => {
		expect(ids(selfStepsOf(card({ isCritical: true })))).toEqual(['rootSelf', 'onCrit', 'onHit']);
	});

	it('leaves out a self step that waits for its button', () => {
		const used = card();
		const tree = used.system.activation.effects as EffectNode[];
		tree.push({ ...applyStep('picked', 'self'), waitsForClick: true } as EffectNode);

		expect(ids(selfStepsOf(used))).toEqual(['rootSelf', 'onHit']);
	});

	it('gives only the steps under a miss for a miss', () => {
		expect(ids(selfStepsOf(card({ isMiss: true })))).toEqual(['rootSelf', 'onMiss']);
	});
});

describe('applySelfEffectsOnUse', () => {
	it('applies each self step of the branch that happened, and no target step', async () => {
		const used = card({ isMiss: true });

		await applySelfEffectsOnUse(used);

		expect(applyEffectFromCard.mock.calls.map(([, node]) => (node as { id: string }).id)).toEqual([
			'rootSelf',
			'onMiss',
		]);
		expect(applyEffectFromCard).toHaveBeenCalledWith(used, expect.anything());
	});

	it('skips a step that the card already put on its user', async () => {
		await applySelfEffectsOnUse(
			card({}, { rootSelf: [{ effectUuid: 'Actor.hero.ActiveEffect.a', actorName: 'Hero' }] }),
		);

		expect(applyEffectFromCard.mock.calls.map(([, node]) => (node as { id: string }).id)).toEqual([
			'onHit',
		]);
	});

	it('applies each step once when the card is read twice at the same time', async () => {
		const used = card();
		applyEffectFromCard.mockImplementation(async (target: unknown, node: unknown) => {
			await Promise.resolve();
			const flags = (target as typeof used).flags[SYSTEM_ID] as {
				appliedEffects: Record<string, unknown[]>;
			};
			flags.appliedEffects[(node as { id: string }).id] = [
				{ effectUuid: 'Actor.hero.ActiveEffect.a', actorName: 'Hero' },
			];
		});

		await Promise.all([applySelfEffectsOnUse(used), applySelfEffectsOnUse(used)]);

		expect(applyEffectFromCard.mock.calls.map(([, node]) => (node as { id: string }).id)).toEqual([
			'rootSelf',
			'onHit',
		]);
		applyEffectFromCard.mockImplementation(async () => {});
	});

	it('leaves every step to its button with Feature Effects off, and does nothing with no card', async () => {
		await applySelfEffectsOnUse(null);
		automation = false;
		await applySelfEffectsOnUse(card());

		expect(applyEffectFromCard).not.toHaveBeenCalled();
	});
});

describe('a Wound step for the user', () => {
	function woundStep(id: string, recipient: 'self' | 'targets', parentContext: string | null) {
		return {
			id,
			type: 'wound',
			amount: 1,
			recipient,
			parentContext,
			parentNode: parentContext ? 'save' : null,
		} as EffectNode;
	}

	function hazardCard(applied = {}) {
		return {
			id: 'message-2',
			flags: { [SYSTEM_ID]: { appliedWounds: applied } },
			system: {
				activation: {
					effects: [
						woundStep('rootSelf', 'self', null),
						woundStep('rootTargets', 'targets', null),
						{
							id: 'save',
							type: 'savingThrow',
							savingThrowType: 'strength',
							parentContext: null,
							parentNode: null,
							on: { failedSave: [woundStep('onFail', 'self', 'failedSave')] },
						},
					] as EffectNode[],
				},
			},
			update: vi.fn(async () => undefined),
		};
	}

	it('gives the Wounds of a root self step on use; a step under a save outcome waits', async () => {
		const used = hazardCard();

		expect(ids(selfStepsOf(used))).toEqual(['rootSelf']);
		await applySelfEffectsOnUse(used);

		expect(giveWoundsFromCard).toHaveBeenCalledTimes(1);
		expect(giveWoundsFromCard).toHaveBeenCalledWith(
			used,
			expect.objectContaining({ id: 'rootSelf' }),
		);
		expect(applyEffectFromCard).not.toHaveBeenCalled();
	});

	it('skips a step that already gave its Wounds, and gives none with Feature Effects off', async () => {
		await applySelfEffectsOnUse(
			hazardCard({ rootSelf: { Actor_hero: { actorName: 'Hero', before: 0, after: 1 } } }),
		);
		automation = false;
		await applySelfEffectsOnUse(hazardCard());

		expect(giveWoundsFromCard).not.toHaveBeenCalled();
	});
});

describe('an End Conditions step for the user', () => {
	function endStep(id: string, recipient: 'self' | 'targets') {
		return {
			id,
			type: 'endConditions',
			recipient,
			which: 'negative',
			conditions: [],
			parentContext: null,
			parentNode: null,
		} as EffectNode;
	}

	function reactionCard(ended = {}) {
		return {
			id: 'message-3',
			flags: { [SYSTEM_ID]: { endedConditions: ended } },
			system: { activation: { effects: [endStep('self', 'self'), endStep('targets', 'targets')] } },
			update: vi.fn(async () => undefined),
		};
	}

	it('ends the conditions of a root self step on use, and leaves the target step to its button', async () => {
		const used = reactionCard();

		await applySelfEffectsOnUse(used);

		expect(endConditionsFromCard).toHaveBeenCalledTimes(1);
		expect(endConditionsFromCard).toHaveBeenCalledWith(
			used,
			expect.objectContaining({ id: 'self' }),
		);
	});

	it('skips a step that the card shows it ran', async () => {
		await applySelfEffectsOnUse(
			reactionCard({ self: { Actor_hero: { actorName: 'Hero', ended: [] } } }),
		);

		expect(endConditionsFromCard).not.toHaveBeenCalled();
	});
});
