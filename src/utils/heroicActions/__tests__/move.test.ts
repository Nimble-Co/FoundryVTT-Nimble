import {
	createHeroicCharacter,
	createHeroicCombatant,
	heroicGlobals,
	resetHeroicGlobals,
	setHeroicCombat,
} from '../../../../tests/fixtures/heroicActions.js';
import { runMoveAction } from '../move.js';

function walker() {
	return createHeroicCharacter({
		system: { attributes: { movement: { walk: 6, fly: 0, climb: 0, swim: 0, burrow: 0 } } },
	});
}

describe('runMoveAction', () => {
	let restore: () => void;

	beforeEach(() => {
		restore = resetHeroicGlobals();
	});

	afterEach(() => restore());

	it('spends 1 action and posts the move card with the walk speed', async () => {
		const actor = walker();
		const combatant = createHeroicCombatant(actor, { currentActions: 2 });
		setHeroicCombat(combatant);

		await runMoveAction(actor);

		expect(combatant.update).toHaveBeenCalledWith({ 'system.actions.base.current': 1 });
		expect(ChatMessage.create).toHaveBeenCalledWith(
			expect.objectContaining({ type: 'moveAction', system: { actorName: actor.name, speed: 6 } }),
		);
	});

	it('stops when the player declines to move with no actions left', async () => {
		const actor = walker();
		setHeroicCombat(createHeroicCombatant(actor, { currentActions: 0 }));
		heroicGlobals().foundry.applications.api.DialogV2.confirm.mockResolvedValue(false);

		await runMoveAction(actor);

		expect(ChatMessage.create).not.toHaveBeenCalled();
	});

	it('warns outside combat', async () => {
		await runMoveAction(walker());

		expect(ui.notifications.warn).toHaveBeenCalled();
		expect(ChatMessage.create).not.toHaveBeenCalled();
	});
});
