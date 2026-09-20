import { SYSTEM_ID, systemHookName } from '#system';

const fromStatusEffect = vi.fn();
const createEffect = vi.fn();
vi.stubGlobal('ActiveEffect', { implementation: { fromStatusEffect, create: createEffect } });

import { NimbleBaseItem } from './base.svelte.js';

function createConditionEffectStub() {
	const source: Record<string, unknown> = { _id: 'concentration-effect' };

	return {
		id: 'concentration-effect',
		statuses: new Set<string>(),
		source,
		updateSource: (data: Record<string, unknown>) => Object.assign(source, data),
		toObject: () => ({ ...source }),
	};
}

/** An existing concentration on the caster, as the replacement path sees it. */
function createHeldConcentration(track: string) {
	return {
		id: `concentration-${track}`,
		statuses: new Set(['concentration']),
		updateSource: vi.fn(),
		toObject: () => ({ _id: `concentration-${track}`, name: track }),
		getFlag: (scope: string, key: string) =>
			scope === SYSTEM_ID && key === 'concentrationTrack' ? track : undefined,
		delete: vi.fn(async () => undefined),
	};
}

type Caster = ReturnType<typeof createCaster>;

function createCaster(held: ReturnType<typeof createHeldConcentration>[] = []) {
	return {
		uuid: 'Actor.caster',
		system: {} as { concentrationTracks?: Set<string> },
		statuses: new Set(held.length > 0 ? ['concentration'] : []),
		effects: held,
	};
}

/** Built on the prototype so the real `_createActivationCard` runs. */
function createItemStub(
	properties: string[],
	{ caster = createCaster(), school = '' } = {} as { caster?: Caster | null; school?: string },
) {
	const tags = new Set(properties.map((property) => `property:${property}`));
	if (school) tags.add(`school:${school}`);

	return Object.assign(Object.create(NimbleBaseItem.prototype), {
		uuid: 'Item.spell',
		type: 'spell',
		tags,
		actor: caster,
		rules: new Map(),
	});
}

const postedMessage = { id: 'message-1', system: { activation: {} } };

/** Re-declared because the real method is protected. */
type ActivationCardHost = {
	_createActivationCard(
		chatData: unknown,
		rolls: unknown[],
		activation: { effects?: unknown[] } | null,
		hookContext: Record<string, unknown>,
	): Promise<unknown>;
};

async function createActivationCard(
	item: ReturnType<typeof createItemStub>,
	{ rolls = [] as unknown[], cardType = 'spell' } = {},
) {
	const chatData = { type: cardType, system: {} } as {
		type: string;
		system: Record<string, unknown>;
	};
	const chatCard = await (item as ActivationCardHost)._createActivationCard(
		chatData,
		rolls,
		{ effects: [] },
		{},
	);

	return { chatCard, chatData };
}

function createdEffectFlags() {
	const [created] = createEffect.mock.calls.at(0) ?? [];

	return (created as { [key: string]: unknown })?.[`flags.${SYSTEM_ID}`];
}

beforeEach(() => {
	fromStatusEffect.mockReset().mockImplementation(async () => createConditionEffectStub());
	createEffect.mockReset().mockImplementation(async (effect: unknown) => effect);
	(CONFIG as { statusEffects?: unknown }).statusEffects = [{ id: 'concentration' }];
	(Hooks.call as ReturnType<typeof vi.fn>).mockReturnValue(true);
	(ChatMessage as unknown as { create: unknown }).create = vi.fn(async () => postedMessage);
	(globalThis as { game?: Record<string, unknown> }).game!.settings = { get: () => true };
	(globalThis as { ui?: Record<string, unknown> }).ui = { notifications: { warn: vi.fn() } };
});

describe('NimbleBaseItem#_createActivationCard concentration', () => {
	it('puts concentration on the caster, crediting the item', async () => {
		const item = createItemStub(['concentration']);

		await createActivationCard(item);

		expect(fromStatusEffect).toHaveBeenCalledWith('concentration', { parent: item.actor });
		expect(createEffect).toHaveBeenCalledWith(expect.objectContaining({ origin: 'Item.spell' }), {
			parent: item.actor,
			keepId: true,
		});
	});

	it('puts nothing on the caster when the item does not carry the property', async () => {
		await createActivationCard(createItemStub(['reach']));

		expect(createEffect).not.toHaveBeenCalled();
	});

	it('puts nothing anywhere when the item has no owner', async () => {
		await createActivationCard(createItemStub(['concentration'], { caster: null }));

		expect(createEffect).not.toHaveBeenCalled();
	});

	it('applies concentration even when a rule suppresses the card', async () => {
		const item = createItemStub(['concentration']);
		item.rules.set('suppressor', { disabled: false, suppressesActivationCard: () => true });

		const { chatCard } = await createActivationCard(item);

		expect(chatCard).toBeNull();
		expect(createEffect).toHaveBeenCalledTimes(1);
	});
});

describe('NimbleBaseItem#_createActivationCard concentration replacement', () => {
	it('ends the concentration already held so the caster holds exactly one', async () => {
		const held = createHeldConcentration('default');
		const item = createItemStub(['concentration'], { caster: createCaster([held]) });

		await createActivationCard(item);

		expect(held.delete).toHaveBeenCalled();
		expect(createEffect).toHaveBeenCalledTimes(1);
	});

	it('keeps the concentration already held when a listener refuses the new one', async () => {
		(Hooks.call as ReturnType<typeof vi.fn>).mockReturnValue(false);
		const held = createHeldConcentration('default');
		const item = createItemStub(['concentration'], { caster: createCaster([held]) });

		await createActivationCard(item);

		expect(held.delete).not.toHaveBeenCalled();
		expect(createEffect).not.toHaveBeenCalled();
	});

	it('restores the concentration already held when creating the new one fails', async () => {
		const held = createHeldConcentration('default');
		const item = createItemStub(['concentration'], { caster: createCaster([held]) });
		createEffect.mockRejectedValueOnce(new Error('no permission'));

		await createActivationCard(item);

		expect(held.delete).toHaveBeenCalled();
		expect(createEffect).toHaveBeenLastCalledWith(
			expect.objectContaining({ _id: 'concentration-default' }),
			{ parent: item.actor, keepId: true },
		);
	});
});

describe('NimbleBaseItem#_createActivationCard concentration tracks', () => {
	it('stamps the default track on a caster with no concentrationTrack rule', async () => {
		await createActivationCard(createItemStub(['concentration'], { school: 'lightning' }));

		expect(createdEffectFlags()).toEqual({ concentrationTrack: 'default' });
	});

	it('stamps the school as the track when a rule tracks it separately', async () => {
		const caster = createCaster();
		caster.system.concentrationTracks = new Set(['lightning', 'wind']);

		await createActivationCard(createItemStub(['concentration'], { caster, school: 'wind' }));

		expect(createdEffectFlags()).toEqual({ concentrationTrack: 'wind' });
	});

	it('leaves a tracked school alone when casting in another tracked school', async () => {
		const held = createHeldConcentration('lightning');
		const caster = createCaster([held]);
		caster.system.concentrationTracks = new Set(['lightning', 'wind']);

		await createActivationCard(createItemStub(['concentration'], { caster, school: 'wind' }));

		expect(held.delete).not.toHaveBeenCalled();
		expect(createEffect).toHaveBeenCalledTimes(1);
	});

	it('ends the concentration on the same tracked school', async () => {
		const held = createHeldConcentration('lightning');
		const caster = createCaster([held]);
		caster.system.concentrationTracks = new Set(['lightning', 'wind']);

		await createActivationCard(createItemStub(['concentration'], { caster, school: 'lightning' }));

		expect(held.delete).toHaveBeenCalled();
	});

	it('ends an untracked school against the default track, not the tracked ones', async () => {
		const lightning = createHeldConcentration('lightning');
		const other = createHeldConcentration('default');
		const caster = createCaster([lightning, other]);
		caster.system.concentrationTracks = new Set(['lightning', 'wind']);

		await createActivationCard(createItemStub(['concentration'], { caster, school: 'fire' }));

		expect(lightning.delete).not.toHaveBeenCalled();
		expect(other.delete).toHaveBeenCalled();
	});
});

describe('NimbleBaseItem#_createActivationCard concentration card flag', () => {
	it('tells the card the caster is concentrating', async () => {
		const { chatData } = await createActivationCard(createItemStub(['concentration']));

		expect(chatData.system.concentration).toBe(true);
	});

	it('leaves the flag off for an item without the property', async () => {
		const { chatData } = await createActivationCard(createItemStub(['reach']));

		expect(chatData.system.concentration).toBe(false);
	});

	it('writes no flag onto a card type whose schema has no concentration field', async () => {
		const { chatData } = await createActivationCard(createItemStub(['concentration']), {
			cardType: 'feature',
		});

		expect(chatData.system.concentration).toBeUndefined();
		expect(createEffect).toHaveBeenCalledTimes(1);
	});

	it('leaves the flag off when a caster immune to concentration refuses it', async () => {
		(Hooks.call as ReturnType<typeof vi.fn>).mockReturnValue(false);

		const { chatData } = await createActivationCard(createItemStub(['concentration']));

		expect(createEffect).not.toHaveBeenCalled();
		expect(chatData.system.concentration).toBe(false);
	});

	it('leaves the flag off and still posts the card when applying the condition throws', async () => {
		fromStatusEffect.mockRejectedValue(new Error('no permission'));

		const { chatCard, chatData } = await createActivationCard(createItemStub(['concentration']));

		expect(chatCard).toBe(postedMessage);
		expect(chatData.system.concentration).toBe(false);
	});

	it('warns the caster when applying the condition throws', async () => {
		fromStatusEffect.mockRejectedValue(new Error('no permission'));
		vi.spyOn(console, 'error').mockImplementation(() => {});

		await createActivationCard(createItemStub(['concentration']));

		expect(ui.notifications?.warn).toHaveBeenCalledWith('NIMBLE.chat.concentrationFailed', {
			localize: true,
		});
	});

	it('still fires the useItem hook when applying the condition throws', async () => {
		fromStatusEffect.mockRejectedValue(new Error('no permission'));

		await createActivationCard(createItemStub(['concentration']));

		expect(Hooks.callAll).toHaveBeenCalledWith(
			systemHookName('useItem'),
			expect.anything(),
			postedMessage,
			expect.anything(),
		);
	});
});
