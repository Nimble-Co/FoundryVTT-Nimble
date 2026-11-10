import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const globals = globalThis as unknown as Record<string, any>;

function target() {
	return {
		actor: {
			uuid: 'Actor.t',
			isOwner: true,
			createEmbeddedDocuments: vi.fn(async () => []),
		},
	};
}

async function capturedHook() {
	vi.resetModules();
	const on = vi.fn();
	globals.Hooks = { ...globals.Hooks, on };
	const { registerHoldOnTargetHooks } = await import('../holdOnTargetOnUse.js');
	registerHoldOnTargetHooks();
	return on.mock.calls[0]?.[1] as (
		item: object,
		card: object | null,
		context: object,
	) => Promise<void>;
}

async function capturedUpdateHook() {
	vi.resetModules();
	const on = vi.fn();
	globals.Hooks = { ...globals.Hooks, on };
	const { registerHoldOnTargetHooks } = await import('../holdOnTargetOnUse.js');
	registerHoldOnTargetHooks();
	return on.mock.calls[1]?.[1] as (card: object, changes: object) => void;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function heldEffect(id: string, sourceMessageId: string) {
	return {
		id,
		name: 'Addling Arrow',
		origin: null,
		system: {
			rules: [
				{
					id: `${id}-rule`,
					type: 'heldRoll',
					heldKind: 'mustAttackOther',
					value: 0,
					appliesTo: 'holderAttacks',
					usedUp: true,
				},
			],
		},
		flags: { nimble: { heldChangeMessage: sourceMessageId } },
	};
}

const item = (rule: object) => ({
	name: 'Grease Trap',
	uuid: 'Item.grease',
	rules: new Map([['0', { type: 'holdOnTarget', ...rule }]]),
});

describe('holdOnTarget on an item use', () => {
	let savedHooks: unknown;

	beforeEach(() => {
		savedHooks = globals.Hooks;
		globals.game.combat = { id: 'c1', started: true, round: 2, turn: 1 };
		globals.game.settings = { get: () => true };
	});

	afterEach(() => {
		globals.Hooks = savedHooks;
		delete globals.game.combat;
		delete globals.game.settings;
	});

	it('holds the change on each target, until the combat ends', async () => {
		const hook = await capturedHook();
		const token = target();

		await hook(item({ heldKind: 'vulnerableOnce', damageType: 'fire' }), null, {
			targets: [token],
		});

		const [, [effect]] = token.actor.createEmbeddedDocuments.mock.calls[0] as unknown as [
			string,
			[{ origin: string; system: { rules: object[]; lastsUntil: object[] } }],
		];
		expect(effect.origin).toBe('Item.grease');
		expect(effect.system.rules).toEqual([
			expect.objectContaining({
				type: 'heldRoll',
				heldKind: 'vulnerableOnce',
				damageType: 'fire',
				appliesTo: 'attacksOnHolder',
			}),
		]);
		expect(effect.system.lastsUntil).toEqual([
			expect.objectContaining({ kind: 'event', event: 'combatEnd' }),
		]);
	});

	it('holds nothing on a miss, or outside combat', async () => {
		const hook = await capturedHook();
		const token = target();

		await hook(item({ heldKind: 'mustAttackOther' }), null, { isMiss: true, targets: [token] });
		globals.game.combat = null;
		await hook(item({ heldKind: 'mustAttackOther' }), null, { targets: [token] });

		expect(token.actor.createEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('holds no vulnerability with no damage type', async () => {
		const hook = await capturedHook();
		const token = target();

		await hook(item({ heldKind: 'vulnerableOnce', damageType: '' }), null, { targets: [token] });

		expect(token.actor.createEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('marks the card, so a new roll can follow it', async () => {
		const hook = await capturedHook();
		const card = { id: 'm1', setFlag: vi.fn() };

		await hook(item({ heldKind: 'mustAttackOther' }), card, { targets: [target()] });
		await hook(item({ heldKind: 'mustAttackOther' }), card, { isMiss: true, targets: [target()] });

		expect(card.setFlag.mock.calls).toEqual([
			['nimble', 'heldOnTargets', true],
			['nimble', 'heldOnTargets', false],
		]);
	});

	describe('a new roll on the card', () => {
		function setup(heldOnTargets: boolean) {
			const actor = {
				uuid: 'Actor.t',
				isOwner: true,
				effects: [heldEffect('e1', 'm1'), heldEffect('e2', 'other')],
				createEmbeddedDocuments: vi.fn(async () => []),
				deleteEmbeddedDocuments: vi.fn(async () => []),
			};
			const rules = new Map([['0', { type: 'holdOnTarget', heldKind: 'mustAttackOther' }]]);
			globals.fromUuidSync = vi.fn((uuid: string) =>
				uuid === 'Item.i' ? { name: 'Addling Arrow', rules } : { actor },
			);
			const card = {
				id: 'm1',
				isAuthor: true,
				author: { active: true },
				flags: { nimble: { itemUuid: 'Item.i', heldOnTargets } },
				system: { targets: ['Scene.s.Token.t'] },
				setFlag: vi.fn(),
			};
			return { actor, card };
		}

		it('takes back only the holds of this card when it becomes a miss', async () => {
			const update = await capturedUpdateHook();
			const { actor, card } = setup(true);

			update(card, { system: { isMiss: true } });
			await flush();

			expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['e1']);
			expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledTimes(1);
			expect(card.setFlag).toHaveBeenCalledWith('nimble', 'heldOnTargets', false);
		});

		it('does not give a spent hold again', async () => {
			const update = await capturedUpdateHook();
			const { actor, card } = setup(true);
			actor.effects = [];

			update(card, { system: { isMiss: true } });
			await flush();
			update(
				{ ...card, flags: { nimble: { itemUuid: 'Item.i', heldOnTargets: 'spent' } } },
				{
					system: { isMiss: false },
				},
			);
			await flush();

			expect(card.setFlag).toHaveBeenCalledWith('nimble', 'heldOnTargets', 'spent');
			expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
		});

		it('is followed by the GM when the author is away', async () => {
			const update = await capturedUpdateHook();
			const { actor, card } = setup(true);
			const savedUsers = globals.game.users;
			const savedUser = globals.game.user;
			globals.game.users = {};
			globals.game.user = { id: 'gm', isGM: true };
			try {
				update(
					{ ...card, isAuthor: false, author: { active: false } },
					{ system: { isMiss: true } },
				);
				await flush();
			} finally {
				globals.game.users = savedUsers;
				globals.game.user = savedUser;
			}

			expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledTimes(1);
		});

		it('gives the holds when a miss becomes a hit', async () => {
			const update = await capturedUpdateHook();
			const { actor, card } = setup(false);

			update(card, { system: { isMiss: false } });
			await flush();

			expect(actor.createEmbeddedDocuments).toHaveBeenCalledTimes(1);
			expect(card.setFlag).toHaveBeenCalledWith('nimble', 'heldOnTargets', true);
		});

		it('does nothing when the outcome stays, or on a card with no mark', async () => {
			const update = await capturedUpdateHook();
			const { actor, card } = setup(true);

			update(card, { system: { isMiss: false } });
			update({ ...card, flags: { nimble: { itemUuid: 'Item.i' } } }, { system: { isMiss: true } });
			await flush();

			expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
			expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
		});
	});
});
