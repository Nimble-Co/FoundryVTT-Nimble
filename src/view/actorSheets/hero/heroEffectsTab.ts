import { activationOf } from '../shared/itemFields.ts';
import { byName } from '../shared/rowOrder.ts';
import type { ConditionLike, EffectLike, ItemLike } from '../shared/sheetSource.ts';
import type { HeroIntent } from './heroIntent.ts';
import type { HeroRowAsk, HeroRowGroup, HeroRowView } from './heroRows.ts';
import type { HeroActorLike, HeroSheetContext } from './heroSource.ts';

const FX = 'NIMBLE.actorSheet.hero.effects';

export interface HeroConditionToggle {
	id: string;
	name: string;
	img: string;
	on: boolean;
	intent: HeroIntent;
}

export interface HeroEffectsTabView {
	/** Active effects, Conditions on you, Passive effects: always all three */
	groups: HeroRowGroup[];
	/** the line in an empty group */
	none: string;
	conditions: { label: string; options: HeroConditionToggle[] };
}

/** A status of a condition puts the effect in "Conditions on you", not in the effect lists. */
function effectLists(actor: HeroActorLike, context: HeroSheetContext) {
	const conditionIds = new Set(Object.keys(context.labels.conditions));
	const effects = actor.effects.filter(
		(effect) => !effect.statuses.some((status) => conditionIds.has(status)),
	);
	const active = effects.filter((effect) => effect.toggle || effect.temporary);
	return {
		active: byName(active),
		passive: byName(effects.filter((effect) => !active.includes(effect))),
		conditions: context.conditions.filter((condition) => condition.active),
	};
}

/** The count on the Effects tab: what is on the hero now, not the passive effects. */
export function effectsOnHero(actor: HeroActorLike, context: HeroSheetContext): number {
	const lists = effectLists(actor, context);
	return lists.active.length + lists.conditions.length;
}

/** "10 minutes" from `activation.duration`; nothing for no duration. */
function activationDuration(item: ItemLike, context: HeroSheetContext): string {
	const duration = (activationOf(item).duration ?? {}) as {
		type?: string;
		quantity?: number;
		details?: string;
	};
	if (!duration.type || duration.type === 'none') return '';
	if (duration.type === 'special') return duration.details ?? '';
	const quantity = duration.quantity ?? 1;
	const unit = context.localize(
		`NIMBLE.${quantity === 1 ? 'durations' : 'durationsPlural'}.${duration.type}`,
	);
	return `${quantity} ${unit}`;
}

/** A toggle state: the inactivity end of its rule, else the activation duration of its item. */
function toggleDuration(
	effect: EffectLike,
	item: ItemLike | undefined,
	context: HeroSheetContext,
): string {
	if (!item || !effect.toggle) return effect.duration;
	const rule = item.rules.find((entry) => entry.id === effect.toggle?.ruleId);
	const rounds = Number(rule?.fields.endAfterInactiveRounds ?? 0);
	if (rounds === 1) return context.localize(`${FX}.inactiveRound`);
	if (rounds > 1) return context.format(`${FX}.inactiveRounds`, { rounds: String(rounds) });
	return activationDuration(item, context) || effect.duration;
}

/** The item that made the effect: its holder, its toggle, or the item in its origin uuid. */
function sourceItem(actor: HeroActorLike, effect: EffectLike): ItemLike | undefined {
	const id = effect.itemId ?? effect.toggle?.itemId ?? effect.origin?.match(/Item\.([^.]+)$/)?.[1];
	return id ? actor.items.find((item) => item.id === id) : undefined;
}

function askRemove(name: string, intent: HeroIntent, context: HeroSheetContext): HeroRowAsk {
	return {
		label: context.format(`${FX}.removeName`, { name }),
		question: context.format(`${FX}.removeQuestion`, { name }),
		confirmLabel: context.localize(`${FX}.remove`),
		intent,
	};
}

function stateRow(
	base: Pick<HeroRowView, 'id' | 'name' | 'img' | 'use'> & {
		duration: string;
		from: string;
		description: string;
	},
	context: HeroSheetContext,
	extra: Partial<HeroRowView> = {},
): HeroRowView {
	const { localize } = context;
	return {
		id: base.id,
		name: base.name,
		img: base.img || undefined,
		summary: base.from || base.description || undefined,
		cost: { text: base.duration || undefined },
		description: base.description || undefined,
		facts: [
			...(base.from ? [[localize(`${FX}.facts.from`), base.from] as [string, string]] : []),
			[localize(`${FX}.facts.lasts`), base.duration || localize(`${FX}.untilItEnds`)],
		],
		use: base.use,
		choice: null,
		edit: null,
		drag: null,
		fields: [],
		...extra,
	};
}

function effectRow(
	actor: HeroActorLike,
	effect: EffectLike,
	context: HeroSheetContext,
	passive: boolean,
): HeroRowView {
	const { localize, format } = context;
	const item = sourceItem(actor, effect);
	const id = `effect-${effect.id}`;
	const base = { id, name: effect.name, img: effect.img, description: effect.description };
	if (effect.toggle) {
		return stateRow(
			{
				...base,
				duration: toggleDuration(effect, item, context),
				from: item ? format(`${FX}.fromItem`, { name: item.name }) : '',
				use: {
					kind: 'act',
					label: format('NIMBLE.actorSheet.shared.endName', { name: effect.name }),
					intent: { kind: 'endEffect', effectId: effect.id },
				},
			},
			context,
			{ state: 'active', tag: localize('NIMBLE.actorSheet.shared.active'), tagOn: true },
		);
	}
	// an item keeps its passive effect on: you change it through the item
	if (passive && item) {
		return stateRow(
			{
				...base,
				duration: effect.duration,
				from: format(`${FX}.fromItem`, { name: item.name }),
				use: null,
			},
			context,
			{ edit: { kind: 'openItem', itemId: item.id } },
		);
	}
	return stateRow(
		{
			...base,
			duration: effect.duration,
			from: item ? format(`${FX}.fromItem`, { name: item.name }) : '',
			use: {
				kind: 'ask',
				ask: askRemove(
					effect.name,
					{ kind: 'removeEffect', effectId: effect.id, itemId: effect.itemId },
					context,
				),
			},
		},
		context,
	);
}

function conditionRow(condition: ConditionLike, context: HeroSheetContext): HeroRowView {
	return stateRow(
		{
			id: `condition-${condition.id}`,
			name: condition.name,
			img: condition.img,
			description: condition.description,
			duration: condition.duration,
			from:
				condition.source && condition.source !== condition.name
					? context.format(`${FX}.fromItem`, { name: condition.source })
					: '',
			use: {
				kind: 'ask',
				ask: askRemove(
					condition.name,
					{ kind: 'setCondition', conditionId: condition.id, active: false },
					context,
				),
			},
		},
		context,
	);
}

/** Active effects, the conditions on the hero and the passive effects; under them, every condition. */
export function heroEffectsTab(
	actor: HeroActorLike,
	context: HeroSheetContext,
): HeroEffectsTabView {
	const { localize } = context;
	const lists = effectLists(actor, context);
	const group = (id: string, rows: HeroRowView[]): HeroRowGroup => ({
		id,
		label: localize(`${FX}.${id}`),
		note: rows.length ? String(rows.length) : '',
		rows,
	});
	return {
		groups: [
			group(
				'active',
				lists.active.map((effect) => effectRow(actor, effect, context, false)),
			),
			group(
				'conditionsOn',
				lists.conditions.map((condition) => conditionRow(condition, context)),
			),
			group(
				'passive',
				lists.passive.map((effect) => effectRow(actor, effect, context, true)),
			),
		],
		none: localize(`${FX}.none`),
		conditions: {
			label: localize(`${FX}.allConditions`),
			options: context.conditions.map((condition) => ({
				id: condition.id,
				name: condition.name,
				img: condition.img,
				on: condition.active,
				intent: { kind: 'setCondition', conditionId: condition.id, active: !condition.active },
			})),
		},
	};
}
