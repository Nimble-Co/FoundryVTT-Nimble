import type { SkillKeyType } from '#types/skillKey.js';
import { assessOptions } from '#utils/assessOptions.js';
import {
	BUILT_IN_HEROIC_ACTIONS,
	BUILT_IN_HEROIC_REACTIONS,
	type BuiltInHeroicReaction,
} from '#utils/incomingReactions/heroicActions.js';
import { plainText } from '../shared/plainText.ts';
import { byName } from '../shared/rowOrder.ts';
import type { ItemLike } from '../shared/sheetSource.ts';
import { signedNumber } from '../shared/signedNumber.ts';
import {
	actionCost,
	actionWords,
	type HeroChoiceOption,
	type HeroRowView,
	isEquipped,
	isMeleeWeapon,
	isWeapon,
	perWord,
} from './heroRows.ts';
import type { HeroActorLike, HeroSheetContext } from './heroSource.ts';

const SHARED = 'NIMBLE.actorSheet.shared';
const ACTIONS = 'NIMBLE.actorSheet.hero.actions';
const HEROIC = 'NIMBLE.ui.heroicActions';

/** The row id of a built-in heroic action, as `reveal()` and the macro deep link use it. */
export const heroicRowId = (actionId: string) => `heroic-${actionId}`;

function builtIn(actionId: string) {
	const found = BUILT_IN_HEROIC_ACTIONS.find((entry) => entry.actionId === actionId);
	if (!found) throw new Error(`No built-in heroic action ${actionId}`);
	return found;
}

function heroicRow(
	actionId: string,
	actionType: 'action' | 'reaction',
	context: HeroSheetContext,
	parts: Pick<HeroRowView, 'name' | 'icon' | 'use' | 'description'> & Partial<HeroRowView>,
): HeroRowView {
	return {
		id: heroicRowId(actionId),
		cost: actionCost(1, context),
		facts: [[context.localize(`${SHARED}.facts.cost`), actionWords(1, context)]],
		choice: null,
		edit: null,
		drag: { kind: 'heroicAction', actionId, actionType, name: parts.name },
		fields: [],
		...parts,
	};
}

export function unarmedStrikeRow(context: HeroSheetContext): HeroRowView {
	const { localize, format } = context;
	const definition = builtIn('unarmedStrike');
	const name = localize(definition.labelKey);
	const reach = format(`${SHARED}.reach`, { distance: '1' });
	return heroicRow('unarmedStrike', 'action', context, {
		name,
		icon: definition.icon,
		summary: [context.unarmedDamage, reach].join(', '),
		description: localize(definition.descriptionKey),
		facts: [
			[localize(`${SHARED}.facts.cost`), actionWords(1, context)],
			[localize(`${SHARED}.facts.range`), reach],
			[localize(`${SHARED}.facts.damage`), context.unarmedDamage],
		],
		use: {
			kind: 'act',
			label: format('NIMBLE.actorSheet.parts.row.use', { name }),
			intent: { kind: 'unarmedStrike' },
		},
	});
}

export function moveRow(actor: HeroActorLike, context: HeroSheetContext): HeroRowView {
	const { localize, format } = context;
	const definition = builtIn('move');
	const name = localize(definition.labelKey);
	return heroicRow('move', 'action', context, {
		name,
		icon: definition.icon,
		summary: format(`${ACTIONS}.speed`, {
			speed: String(actor.system.attributes.movement.walk ?? 0),
		}),
		description: plainText(localize(`${HEROIC}.move.panelDescription`)),
		use: {
			kind: 'act',
			label: format('NIMBLE.actorSheet.parts.row.use', { name }),
			intent: { kind: 'move' },
		},
	});
}

export function assessRow(actor: HeroActorLike, context: HeroSheetContext): HeroRowView {
	const { localize, format } = context;
	const definition = builtIn('assess');
	const name = localize(definition.labelKey);
	const skills = byName(
		Object.entries(actor.system.skills).map(([key, skill]) => ({
			key: key as SkillKeyType,
			name: localize(`NIMBLE.skills.${key}`),
			mod: signedNumber(skill.mod),
		})),
	);
	return heroicRow('assess', 'action', context, {
		name,
		icon: definition.icon,
		summary: format(`${ACTIONS}.assessSummary`, { dc: '12' }),
		description: localize(definition.descriptionKey),
		use: { kind: 'choose', label: format(`${ACTIONS}.chooseUse`, { name }) },
		choice: {
			kind: 'twoStep',
			label: localize(`${ACTIONS}.chooseOne`),
			options: assessOptions.map((option) => ({
				id: option.id,
				label: localize(option.titleKey),
				description: localize(option.descriptionKey),
				next: {
					label: localize(`${ACTIONS}.chooseSkill`),
					options: skills.map((skill) => ({
						label: `${skill.name} ${skill.mod}`,
						intent: { kind: 'assess', option: option.id, skill: skill.key },
					})),
				},
			})),
		},
	});
}

function targetLine(context: HeroSheetContext): string {
	const { targets } = context;
	if (!targets.length) return context.localize(`${ACTIONS}.noTarget`);
	if (targets.length === 1) return context.format(`${ACTIONS}.target`, { name: targets[0] });
	return context.format(`${ACTIONS}.targets`, { names: targets.join(', ') });
}

function reactionOptions(
	definition: BuiltInHeroicReaction,
	actor: HeroActorLike,
	context: HeroSheetContext,
): HeroChoiceOption[] {
	const { localize } = context;
	if (definition.reactionKey === 'opportunityAttack') {
		const weapons = byName(
			actor.items.filter(
				(item: ItemLike) => isWeapon(item) && isEquipped(item) && isMeleeWeapon(item),
			),
		);
		return [
			...weapons.map(
				(weapon): HeroChoiceOption => ({
					label: weapon.name,
					intent: { kind: 'opportunityAttack', weaponId: weapon.id },
				}),
			),
			{
				label: localize(`${HEROIC}.unarmedStrike`),
				intent: { kind: 'opportunityAttack', weaponId: null },
			},
		];
	}
	const reaction = definition.reactionKey as 'defend' | 'interpose' | 'help';
	return [
		{
			label: localize(`${HEROIC}.reactions.${definition.actionId}.confirm`),
			intent: { kind: 'reaction', reaction },
		},
	];
}

function reactionRow(
	definition: BuiltInHeroicReaction,
	actor: HeroActorLike,
	context: HeroSheetContext,
): HeroRowView {
	const { localize, format } = context;
	const name = localize(definition.labelKey);
	const description = localize(definition.descriptionKey);
	const spent = context.combat?.reactionsSpent.includes(definition.reactionKey) ?? false;
	const round = perWord('round', context) ?? '';
	const opportunity = definition.reactionKey === 'opportunityAttack';
	return heroicRow(definition.actionId, 'reaction', context, {
		name,
		icon: definition.icon,
		tag: spent ? localize(`${SHARED}.used`) : undefined,
		state: spent ? 'used' : undefined,
		summary: spent ? format(`${SHARED}.reason.usedThis`, { per: round }) : description,
		description,
		cost: {
			...actionCost(1, context),
			uses: [{ left: spent ? 0 : 1, max: 1, per: round }],
		},
		facts: [
			[localize(`${SHARED}.facts.cost`), actionWords(1, context)],
			[
				localize(`${SHARED}.facts.uses`),
				format(`${SHARED}.usesBack`, { left: spent ? '0' : '1', max: '1', per: round }),
			],
		],
		use: { kind: 'choose', label: format(`${ACTIONS}.chooseUse`, { name }) },
		choice: {
			kind: 'options',
			label: opportunity ? localize(`${HEROIC}.reactions.opportunity.selectWeapon`) : name,
			lines: [
				targetLine(context),
				...(opportunity ? [localize(`${HEROIC}.reactions.opportunity.disadvantage`)] : []),
			],
			options: reactionOptions(definition, actor, context),
		},
	});
}

/** Defend, Interpose, Opportunity Attack and Help. */
export function reactionRows(actor: HeroActorLike, context: HeroSheetContext): HeroRowView[] {
	return BUILT_IN_HEROIC_REACTIONS.map((definition) => reactionRow(definition, actor, context));
}
