import {
	createHeroicCharacter,
	createHeroicCombatant,
	resetHeroicGlobals,
	setHeroicCombat,
} from '../../../../tests/fixtures/heroicActions.js';
import { opportunityAttackLines } from '../opportunityAttackLines.js';

const FRIENDLY = 1;
const HOSTILE = -1;

function creature(id: string, rules: Record<string, unknown>[] = []) {
	return createHeroicCharacter({
		id,
		uuid: `Actor.${id}`,
		items: [
			{
				uuid: `Actor.${id}.Item.feature`,
				name: 'No Escape',
				rules: new Map(
					rules.map((rule) => [rule.id as string, { appliesTo: () => true, ...rule }]),
				),
			},
		],
	});
}

function inCombat(actor: ReturnType<typeof creature>, disposition: number) {
	const combatant = createHeroicCombatant(actor);
	return Object.assign(combatant, {
		id: `combatant-${actor.id}`,
		token: { id: `token-${actor.id}`, disposition, actor },
	});
}

const noEscape = {
	type: 'grantActivation',
	id: 'no-escape',
	trigger: 'onAllyOpportunityAttack',
	spendsReaction: true,
	weaponKind: 'ranged',
};

let restore: () => void;
beforeEach(() => {
	restore = resetHeroicGlobals();
});
afterEach(() => restore());

describe('the lines on the card of an opportunity attack', () => {
	it("gives each ally in the combat a line from their rules for an ally's opportunity attack", () => {
		const fighter = creature('fighter');
		const hunter = creature('hunter', [noEscape]);
		const goblin = creature('goblin', [noEscape]);
		const combat = setHeroicCombat(inCombat(fighter, FRIENDLY) as never);
		combat.combatants = [
			inCombat(fighter, FRIENDLY),
			inCombat(hunter, FRIENDLY),
			inCombat(goblin, HOSTILE),
		] as never;

		const lines = opportunityAttackLines(fighter);

		expect(lines).toHaveLength(1);
		expect(lines[0]).toMatchObject({
			targetActorUuid: 'Actor.hunter',
			label: 'No Escape',
			spendsReaction: true,
			weaponKind: 'ranged',
		});
	});

	it('gives no lines out of combat', () => {
		expect(opportunityAttackLines(creature('fighter'))).toEqual([]);
	});
});
