import { describe, expect, it, vi } from 'vitest';
import { getTestGlobals } from '../../../tests/helpers.js';
import { createHookCapture } from '../../../tests/mocks/combat.js';
import registerDeleteItemOriginEffectsHooks, {
	deleteOriginEffects,
} from '../deleteItemOriginEffects.ts';

const ITEM_UUID = 'Actor.hero.Item.feature';

function actorWith(effects: { id: string; origin?: string | null }[]) {
	return Object.assign(Object.create(Actor.prototype), {
		effects,
		deleteEmbeddedDocuments: vi.fn(async () => []),
	});
}

describe('deleteOriginEffects', () => {
	it('deletes the effects on the actor that the item gave, in one call', async () => {
		const actor = actorWith([
			{ id: 'a', origin: ITEM_UUID },
			{ id: 'b', origin: 'Actor.hero.Item.other' },
			{ id: 'c', origin: ITEM_UUID },
			{ id: 'd', origin: null },
		]);

		await deleteOriginEffects({ uuid: ITEM_UUID, parent: actor });

		expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledTimes(1);
		expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['a', 'c']);
	});

	it('deletes nothing when no effect came from the item, or the item was on no actor', async () => {
		const actor = actorWith([{ id: 'b', origin: 'Actor.hero.Item.other' }]);

		await deleteOriginEffects({ uuid: ITEM_UUID, parent: actor });
		await deleteOriginEffects({ uuid: ITEM_UUID, parent: null });

		expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('runs only on the client of the user who deleted the item', async () => {
		const globals = getTestGlobals<{
			game: { user: { id: string } | null };
			Hooks: { on: unknown };
		}>();
		const callbacks = createHookCapture(globals.Hooks.on as never);
		globals.game.user = { id: 'user-1' };
		registerDeleteItemOriginEffectsHooks();
		const hook = callbacks.get('deleteItem') as (
			item: unknown,
			options: unknown,
			userId: string,
		) => void;
		const actor = actorWith([{ id: 'a', origin: ITEM_UUID }]);

		hook({ uuid: ITEM_UUID, parent: actor }, {}, 'user-2');
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();

		hook({ uuid: ITEM_UUID, parent: actor }, {}, 'user-1');
		await vi.waitFor(() => expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledTimes(1));
	});
});
