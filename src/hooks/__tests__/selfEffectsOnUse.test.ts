import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import type { EffectNode } from '#types/effectTree.js';

const applyEffectFromCard = vi.fn(async (..._args: unknown[]) => {});
let automation = true;

let applySelfEffectsOnUse: typeof import('../selfEffectsOnUse.js').applySelfEffectsOnUse;
let selfStepsOf: typeof import('../selfEffectsOnUse.js').selfStepsOf;

beforeEach(async () => {
	applyEffectFromCard.mockClear();
	automation = true;
	vi.resetModules();
	vi.doMock('#utils/chat/applyEffectFromCard.js', async (importOriginal) => ({
		...(await importOriginal<object>()),
		applyEffectFromCard,
	}));
	vi.doMock('../../settings/automationSettings.js', async (importOriginal) => ({
		...(await importOriginal<object>()),
		isRuleAutomationEnabled: () => automation,
	}));
	({ applySelfEffectsOnUse, selfStepsOf } = await import('../selfEffectsOnUse.js'));
	vi.doUnmock('#utils/chat/applyEffectFromCard.js');
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

	it('leaves every step to its button with Feature Effects off, and does nothing with no card', async () => {
		await applySelfEffectsOnUse(null);
		automation = false;
		await applySelfEffectsOnUse(card());

		expect(applyEffectFromCard).not.toHaveBeenCalled();
	});
});
