import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import type { EndConditionsNode } from '#types/effectTree.js';

const endEffects = vi.fn(async (..._args: unknown[]) => true);

let endConditionsFromCard: typeof import('../endConditionsFromCard.js').endConditionsFromCard;
let endedConditions: typeof import('../endConditionsFromCard.js').endedConditions;

function creature(uuid: string, name: string, ...statuses: string[]) {
	const effects = statuses.map((status) => ({
		id: status,
		name: status.charAt(0).toUpperCase() + status.slice(1),
		statuses: new Set([status]),
	}));
	return { uuid, name, effects, statuses: new Set(statuses) };
}

const hero = creature('Actor.tessa', 'Tessa', 'dazed', 'poisoned', 'concentration');
const goblin = creature('Scene.s.Token.g.Actor.goblin', 'Goblin');

function step(recipient: EndConditionsNode['recipient']): EndConditionsNode {
	return {
		id: 'e1',
		type: 'endConditions',
		recipient,
		which: 'negative',
		conditions: [],
		parentContext: null,
		parentNode: null,
	};
}

function card(targets: string[] = []) {
	return {
		id: 'use-1',
		flags: { [SYSTEM_ID]: { itemUuid: 'Actor.tessa.Item.glacial' } } as Record<string, unknown>,
		system: { targets },
		update: vi.fn(async () => undefined),
	};
}

beforeEach(async () => {
	endEffects.mockClear().mockResolvedValue(true);
	vi.resetModules();
	vi.doMock('#utils/lastsUntil/endEffects.js', async (importOriginal) => ({
		...(await importOriginal<object>()),
		endEffects,
	}));
	({ endConditionsFromCard, endedConditions } = await import('../endConditionsFromCard.js'));
	vi.doUnmock('#utils/lastsUntil/endEffects.js');
	const documents: Record<string, unknown> = {
		'Actor.tessa.Item.glacial': { uuid: 'Actor.tessa.Item.glacial', name: 'Glacial', actor: hero },
		'Scene.s.Token.g': { actor: goblin },
	};
	vi.stubGlobal(
		'fromUuidSync',
		vi.fn((uuid: string) => documents[uuid] ?? null),
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('endConditionsFromCard', () => {
	it('ends the matching effects through the end path, with the card as host, and records them', async () => {
		const used = card();

		await endConditionsFromCard(used, step('self'));

		expect(endEffects).toHaveBeenCalledWith([hero.effects[0], hero.effects[1]], {
			heading: { key: 'NIMBLE.chat.events.useHeading', data: { name: 'Tessa', item: 'Glacial' } },
			hostId: 'use-1',
			reason: { key: 'NIMBLE.chat.endConditions.endedBy', data: { item: 'Glacial' } },
		});
		expect(used.update).toHaveBeenCalledWith({
			[`flags.${SYSTEM_ID}.endedConditions.e1.Actor_tessa`]: {
				actorName: 'Tessa',
				ended: ['Dazed', 'Poisoned'],
			},
		});
	});

	it('records a target with nothing to end, and ends nothing on it', async () => {
		const used = card(['Scene.s.Token.g']);

		await endConditionsFromCard(used, step('targets'));

		expect(endEffects).not.toHaveBeenCalled();
		expect(used.update).toHaveBeenCalledWith({
			[`flags.${SYSTEM_ID}.endedConditions.e1.Scene_s_Token_g_Actor_goblin`]: {
				actorName: 'Goblin',
				ended: [],
			},
		});
	});

	it('records nothing when no GM took the ends, so the button stays', async () => {
		endEffects.mockResolvedValue(false);
		const used = card();

		await endConditionsFromCard(used, step('self'));

		expect(used.update).not.toHaveBeenCalled();
		expect(endedConditions(used, 'e1')).toBeUndefined();
	});
});
