import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import type { WoundNode } from '#types/effectTree.js';
import { appliedWounds, giveWoundsFromCard } from '../woundFromCard.js';

function creature(uuid: string, name: string, wounds: number | null) {
	const actor = {
		uuid,
		name,
		isOwner: true,
		system: { attributes: wounds === null ? {} : { wounds: { value: wounds, max: 6 } } },
		update: vi.fn(async () => actor),
	};
	return actor;
}

const tessa = creature('Actor.tessa', 'Tessa', 1);
const goblinA = creature('Scene.s.Token.a.Actor.goblin', 'Goblin', null);
const goblinB = creature('Scene.s.Token.b.Actor.goblin', 'Goblin', null);

function woundStep(recipient: WoundNode['recipient'], amount = 1): WoundNode {
	return { id: 'w1', type: 'wound', amount, recipient, parentContext: null, parentNode: null };
}

function card(targets: string[]) {
	return {
		id: 'message-1',
		flags: { [SYSTEM_ID]: { itemUuid: 'Actor.tessa.Item.hazard' } } as Record<string, unknown>,
		system: { targets },
		update: vi.fn(async () => undefined),
	};
}

beforeEach(() => {
	tessa.system.attributes = { wounds: { value: 1, max: 6 } };
	tessa.update.mockClear();
	const tokens: Record<string, unknown> = {
		'Actor.tessa.Item.hazard': { uuid: 'Actor.tessa.Item.hazard', actor: tessa },
		'Scene.s.Token.tessa': { actor: tessa },
		'Scene.s.Token.a': { actor: goblinA },
		'Scene.s.Token.b': { actor: goblinB },
	};
	vi.stubGlobal(
		'fromUuidSync',
		vi.fn((uuid: string) => tokens[uuid] ?? null),
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('giveWoundsFromCard', () => {
	it('gives each target the Wounds and records each one, also two tokens of one actor', async () => {
		const used = card(['Scene.s.Token.tessa', 'Scene.s.Token.a', 'Scene.s.Token.b']);

		await giveWoundsFromCard(used, woundStep('targets', 2));

		expect(tessa.update).toHaveBeenCalledWith({ 'system.attributes.wounds.value': 3 });
		expect(used.update).toHaveBeenCalledWith({
			[`flags.${SYSTEM_ID}.appliedWounds.w1.Actor_tessa`]: {
				actorName: 'Tessa',
				before: 1,
				after: 3,
			},
			[`flags.${SYSTEM_ID}.appliedWounds.w1.Scene_s_Token_a_Actor_goblin`]: {
				actorName: 'Goblin',
				noTrack: true,
			},
			[`flags.${SYSTEM_ID}.appliedWounds.w1.Scene_s_Token_b_Actor_goblin`]: {
				actorName: 'Goblin',
				noTrack: true,
			},
		});
	});

	it('gives a step for you to the one who used the item, with no target', async () => {
		const used = card([]);

		await giveWoundsFromCard(used, woundStep('self'));

		expect(tessa.update).toHaveBeenCalledWith({ 'system.attributes.wounds.value': 2 });
		expect(used.update).toHaveBeenCalledTimes(1);
	});

	it('writes nothing on the card when no creature took the Wounds', async () => {
		const used = card([]);

		await giveWoundsFromCard(used, woundStep('targets'));

		expect(used.update).not.toHaveBeenCalled();
	});
});

describe('appliedWounds', () => {
	it('reads the record of one step', () => {
		const used = card([]);
		used.flags[SYSTEM_ID] = {
			appliedWounds: { w1: { Actor_tessa: { actorName: 'Tessa', before: 0, after: 1 } } },
		};

		expect(appliedWounds(used, 'w1')).toEqual({
			Actor_tessa: { actorName: 'Tessa', before: 0, after: 1 },
		});
		expect(appliedWounds(used, 'other')).toBeUndefined();
	});
});
