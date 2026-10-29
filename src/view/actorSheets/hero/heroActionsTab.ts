import { placeOf } from '../shared/placeOf.ts';
import { byName } from '../shared/rowOrder.ts';
import type { ItemLike } from '../shared/sheetSource.ts';
import { assessRow, moveRow, reactionRows, unarmedStrikeRow } from './heroicRows.ts';
import { type HeroRowGroup, isEquipped, isWeapon, itemRow } from './heroRows.ts';
import type { HeroActorLike, HeroSheetContext } from './heroSource.ts';

const ACTIONS = 'NIMBLE.actorSheet.hero.actions';

export interface HeroActionsTabView {
	/** the things that you do on your turn */
	turnGroups: HeroRowGroup[];
	/** the Reactions group */
	reactionGroups: HeroRowGroup[];
	/** in combat when it is not your turn: one column shows the reactions first */
	reactionsFirst: boolean;
}

const isReactionSpell = (spell: ItemLike) => placeOf(spell) === 'reaction';

function reactionsNote(context: HeroSheetContext): string {
	const { combat, localize } = context;
	if (!combat) return localize(`${ACTIONS}.reactionsNote.outOfCombat`);
	return localize(`${ACTIONS}.reactionsNote.${combat.isTurn ? 'yourTurn' : 'notYourTurn'}`);
}

/** Equipped weapons, Unarmed Strike, the features that act, spells in combat, the heroic actions and the reactions. */
export function heroActionsTab(
	actor: HeroActorLike,
	context: HeroSheetContext,
): HeroActionsTabView {
	const { localize, combat } = context;
	const row = (item: ItemLike) => itemRow(actor, item, context);
	const weapons = actor.items.filter(isWeapon);
	const equipped = weapons.filter(isEquipped);
	const actionFeatures = actor.items.filter(
		(item) => item.type === 'feature' && placeOf(item) === 'action',
	);
	const reactionItems = actor.items.filter(
		(item) => (item.type === 'feature' || item.type === 'object') && placeOf(item) === 'reaction',
	);
	const spells = combat ? actor.items.filter((item) => item.type === 'spell') : [];

	const turnGroups: HeroRowGroup[] = [
		{
			id: 'weapons',
			label: localize(`${ACTIONS}.groups.weapons`),
			hint: weapons.length && !equipped.length ? localize(`${ACTIONS}.equipHint`) : undefined,
			rows: byName([...equipped.map(row), unarmedStrikeRow(context)]),
		},
		{
			id: 'features',
			label: localize(`${ACTIONS}.groups.features`),
			rows: byName(actionFeatures.map(row)),
		},
		{
			id: 'spells',
			label: localize(`${ACTIONS}.groups.spells`),
			rows: byName(spells.filter((spell) => !isReactionSpell(spell)).map(row)),
		},
		{
			id: 'heroic',
			label: localize(`${ACTIONS}.groups.heroic`),
			rows: byName([assessRow(actor, context), moveRow(actor, context)]),
		},
	].filter((group) => group.id === 'weapons' || group.id === 'heroic' || group.rows.length);

	return {
		turnGroups,
		reactionGroups: [
			{
				id: 'reactions',
				label: localize(`${ACTIONS}.groups.reactions`),
				note: reactionsNote(context),
				now: !!combat && !combat.isTurn,
				rows: byName([
					...reactionRows(actor, context),
					...reactionItems.map(row),
					...spells.filter(isReactionSpell).map(row),
				]),
			},
		],
		reactionsFirst: !!combat && !combat.isTurn,
	};
}
