import type { RowCostProps } from '#types/components/actorSheets/RowCost.d.ts';
import type { RowUses, ViewOption } from '../parts/types.ts';
import type { DragDescriptor } from '../shared/drag.ts';
import {
	activationCost,
	activationOf,
	selectedProperties,
	spellTier,
} from '../shared/itemFields.ts';
import { placeOf } from '../shared/placeOf.ts';
import { plainText } from '../shared/plainText.ts';
import type { ItemLike } from '../shared/sheetSource.ts';
import type { HeroIntent } from './heroIntent.ts';
import type {
	ChargeGateLike,
	HeroActorLike,
	HeroItemState,
	HeroSheetContext,
	PoolRecovery,
} from './heroSource.ts';

const SHARED = 'NIMBLE.actorSheet.shared';
const ACTIONS = 'NIMBLE.actorSheet.hero.actions';

/** A question in a ConfirmBar under the row; Yes sends the intent. */
export interface HeroRowAsk {
	/** the label of the control that asks */
	label: string;
	question: string;
	confirmLabel: string;
	intent: HeroIntent;
}

/** What a click on the row does: act at once, open its choice step, ask first, or nothing, with the reason. */
export type HeroRowUse =
	| { kind: 'act'; label: string; intent: HeroIntent }
	| { kind: 'choose'; label: string }
	| { kind: 'ask'; ask: HeroRowAsk }
	| { kind: 'blocked'; label: string; reason: string };

export interface HeroChoiceOption {
	label: string;
	description?: string;
	intent: HeroIntent;
}

/** One `diceConsumer` of the row: pick dice from its pool, then spend them. */
export interface HeroDiceSpend {
	itemId: string;
	ruleId: string;
	poolId: string;
	label: string;
	faces: { value: number; label: string; disabled: boolean }[];
	/** the most dice that one spend takes; null for no limit */
	cap: number | null;
	spendLabel: string;
	/** the pool has no dice: the note says so, and there is nothing to pick */
	empty: string | null;
}

/** The choices under a row. The selection while the step is open is UI state. */
export type HeroChoiceStep =
	| { kind: 'options'; label: string; lines: string[]; options: HeroChoiceOption[] }
	| {
			kind: 'twoStep';
			label: string;
			backLabel: string;
			options: {
				id: string;
				label: string;
				description: string;
				next: { label: string; options: HeroChoiceOption[] };
			}[];
	  }
	| { kind: 'dice'; label: string; cancelLabel: string; spends: HeroDiceSpend[] };

/** A number that you type in edit mode: the charges left in a pool of the item, or its quantity. */
export type HeroRowField =
	| { kind: 'uses'; poolId: string; label: string; value: number; max: number; per: string }
	| { kind: 'quantity'; itemId: string; label: string; value: number };

/** The edit-mode select that moves an object in or out of a container. */
export interface HeroStoreIn {
	itemId: string;
	label: string;
	/** the id of the container that holds the object; empty for loose */
	value: string;
	options: ViewOption[];
}

export interface HeroRowView {
	/** the item id, or `heroic-<actionId>` for a built-in heroic action */
	id: string;
	name: string;
	img?: string;
	icon?: string;
	tag?: string;
	tagOn?: boolean;
	summary?: string;
	/** warn: a risk, for example a container over its capacity */
	summaryTone?: 'act' | 'warn';
	cost: RowCostProps;
	description?: string;
	/** the description as Foundry enriches it (inline rolls, links), in place of the plain text */
	descriptionHtml?: string;
	facts: [string, string][];
	state?: 'active' | 'used' | 'out';
	use: HeroRowUse | null;
	choice: HeroChoiceStep | null;
	/** the pen: open the item window; null = no window */
	edit: HeroIntent | null;
	drag: DragDescriptor | null;
	fields: HeroRowField[];
	/** an item that you can equip: the tag is the toggle */
	equip?: { on: boolean; intent: HeroIntent };
	/** a stored object, under its container */
	indent?: boolean;
	/** edit mode: where the object is */
	storeIn?: HeroStoreIn;
	/** a drop of an item on the row stores it in this container; empty = loose */
	dropInto?: string;
	/** edit mode: the trash button, which asks first */
	remove?: HeroRowAsk;
}

export interface HeroRowGroup {
	id: string;
	label: string;
	note?: string;
	/** the group applies now: the label in the highlight colour */
	now?: boolean;
	/** a line under the rows */
	hint?: string;
	rows: HeroRowView[];
	/** groups under the rows, each with a subheading (the class features of a class) */
	subgroups?: { id: string; label: string; rows: HeroRowView[] }[];
}

export function itemStateOf(context: HeroSheetContext, item: ItemLike): HeroItemState {
	const state = context.itemState[item.id];
	if (state) return state;
	const cost = activationCost(item);
	return {
		actionCost: cost.type === 'action' ? cost.quantity : 0,
		pools: [],
		gate: null,
		toggle: null,
		diceConsumers: [],
	};
}

export function isWeapon(item: ItemLike): boolean {
	return item.type === 'object' && item.system.objectType === 'weapon';
}

export function isEquipped(item: ItemLike): boolean {
	return item.system.equipped === true;
}

/** A weapon that you can swing: not one with only the range property. */
export function isMeleeWeapon(item: ItemLike): boolean {
	const properties = selectedProperties(item);
	return (
		!properties.includes('range') || properties.includes('reach') || properties.includes('thrown')
	);
}

export function perWord(per: PoolRecovery | null, context: HeroSheetContext): string | undefined {
	return per ? context.localize(`${SHARED}.per.${per}`) : undefined;
}

export function actionWords(count: number, context: HeroSheetContext): string {
	return count === 1
		? context.localize('NIMBLE.actorSheet.parts.rowCost.action')
		: context.format('NIMBLE.actorSheet.parts.rowCost.actions', { count: String(count) });
}

/** The cost of a use in actions, with the cells that this turn cannot pay. */
export function actionCost(count: number, context: HeroSheetContext): RowCostProps {
	if (count === 0) return { free: true };
	const left = context.combat?.actions.current ?? count;
	return { actions: count, actionsSpent: Math.max(0, count - left) };
}

function gateReason(gate: ChargeGateLike, context: HeroSheetContext): string {
	const { format } = context;
	const per = perWord(gate.per, context);
	if (gate.code === 'insufficientCharges') {
		if (per && gate.poolMax === 1) return format(`${SHARED}.reason.usedThis`, { per });
		if (per) return format(`${SHARED}.reason.noUsesUntil`, { per });
		return format(`${SHARED}.reason.notEnough`, { pool: gate.poolLabel });
	}
	if (gate.code === 'poolMissing')
		return format(`${SHARED}.reason.poolMissing`, { pool: gate.poolLabel });
	return format(`${SHARED}.reason.cannotPay`, { pool: gate.poolLabel });
}

type EffectNode = Record<string, unknown>;

/** Every node of an activation effect tree, the `on` branches included. */
function effectNodes(nodes: unknown): EffectNode[] {
	if (!Array.isArray(nodes)) return [];
	return nodes.flatMap((node: EffectNode) => {
		const on = (node?.on ?? {}) as Record<string, unknown>;
		return [node, ...Object.values(on).flatMap((branch) => effectNodes(branch))];
	});
}

function damageNodes(item: ItemLike): { formula: string; damageType: string }[] {
	return effectNodes(activationOf(item).effects)
		.filter((node) => node.type === 'damage')
		.map((node) => ({
			formula: typeof node.formula === 'string' ? node.formula : '',
			damageType: typeof node.damageType === 'string' ? node.damageType : '',
		}));
}

export function damageWords(item: ItemLike, context: HeroSheetContext): string[] {
	const types = [
		...new Set(
			damageNodes(item)
				.map((node) => node.damageType)
				.filter(Boolean),
		),
	];
	return types.map((type) =>
		context.format(`${SHARED}.damageType`, { type: context.labels.damageTypes[type] ?? type }),
	);
}

function damageFormula(item: ItemLike): string {
	return damageNodes(item)
		.map((node) => node.formula)
		.filter(Boolean)
		.join(' + ');
}

type Span = { min?: number | null; max?: number | null };

const spanEnd = (span: Span | undefined) => span?.max ?? span?.min ?? 0;

/** "Range 8" or "Reach 2": the range and reach properties first, then the attack type of the targets. */
export function rangeWords(item: ItemLike, context: HeroSheetContext): string {
	const properties = (item.system.properties ?? {}) as { range?: Span; reach?: Span };
	const selected = selectedProperties(item);
	const targets = (activationOf(item).targets ?? {}) as { attackType?: string; distance?: number };
	const words = (key: 'range' | 'reach', distance: number) =>
		distance ? context.format(`${SHARED}.${key}`, { distance: String(distance) }) : '';
	if (selected.includes('range')) return words('range', spanEnd(properties.range));
	if (selected.includes('reach')) return words('reach', spanEnd(properties.reach));
	if (targets.attackType === 'range') {
		return words('range', targets.distance || spanEnd(properties.range));
	}
	if (targets.attackType === 'reach') {
		return words('reach', targets.distance || spanEnd(properties.reach));
	}
	return '';
}

/** The description HTML that a row shows: a spell shows its base effect. */
export function rawDescriptionOf(item: { system: object }): string {
	const { description } = item.system as { description?: unknown };
	if (typeof description === 'string') return description;
	const parts = (description ?? {}) as Record<string, unknown>;
	return String(parts.baseEffect ?? parts.public ?? '');
}

/** The trigger of a reaction ("When an ally is hit"), from the cost details. */
function whenWords(item: ItemLike): string {
	const details = (activationOf(item).cost as { details?: unknown } | undefined)?.details;
	return placeOf(item) === 'reaction' && typeof details === 'string' ? details : '';
}

function usesOf(state: HeroItemState, context: HeroSheetContext): RowUses[] {
	return state.pools.map((pool) => ({
		left: pool.current,
		max: pool.max,
		per: perWord(pool.per, context),
		need: pool.need,
	}));
}

function usesFacts(state: HeroItemState, context: HeroSheetContext): [string, string][] {
	const label = context.localize(`${SHARED}.facts.uses`);
	return state.pools.map((pool) => {
		const per = perWord(pool.per, context);
		const data = { left: String(pool.current), max: String(pool.max) };
		return [
			label,
			per
				? context.format(`${SHARED}.usesBack`, { ...data, per })
				: context.format(`${SHARED}.usesLeft`, data),
		];
	});
}

function hasMana(actor: HeroActorLike, context: HeroSheetContext): boolean {
	const { mana } = actor.system.resources;
	return context.manaFromInitiative || mana.max > 0 || mana.baseMax > 0;
}

/** The dice pool consumer step of a row. */
function diceStep(
	item: ItemLike,
	state: HeroItemState,
	context: HeroSheetContext,
): HeroChoiceStep | null {
	const { localize, format } = context;
	const spends = state.diceConsumers.flatMap((consumer): HeroDiceSpend[] => {
		const pool = context.dicePools.find((entry) => entry.id === consumer.poolId);
		if (!pool) return [];
		const die = Number.parseInt(pool.dieSize.replace(/^d/, ''), 10) || 0;
		return [
			{
				itemId: item.id,
				ruleId: consumer.ruleId,
				poolId: pool.id,
				label: format(`${ACTIONS}.diceStep`, { label: consumer.label, pool: pool.label }),
				faces: pool.faces.map((value, index) => ({
					value,
					label: format('NIMBLE.actorSheet.hero.meter.dieLabel', {
						label: pool.label,
						number: String(index + 1),
						face: String(value),
					}),
					disabled: consumer.maximize && value >= die,
				})),
				cap: consumer.cap,
				spendLabel: localize(`${ACTIONS}.spend`),
				empty: pool.faces.length
					? null
					: format('NIMBLE.dicePoolTracker.spendRequestEmptyPool', { label: pool.label }),
			},
		];
	});
	if (!spends.length) return null;
	return {
		kind: 'dice',
		label: localize(`${ACTIONS}.pickDice`),
		cancelLabel: localize(`${ACTIONS}.cancel`),
		spends,
	};
}

/** The intent of a dice spend with the dice that the player picked. */
export function spendIntent(spend: HeroDiceSpend, indices: number[]): HeroIntent {
	return {
		kind: 'spendDice',
		itemId: spend.itemId,
		ruleId: spend.ruleId,
		poolId: spend.poolId,
		indices: [...indices].sort((a, b) => a - b),
	};
}

/** A row for an item of the hero: a weapon, a feature or a spell. */
export function itemRow(
	actor: HeroActorLike,
	item: ItemLike,
	context: HeroSheetContext,
	options: { withTier?: boolean } = {},
): HeroRowView {
	const { localize, format } = context;
	const state = itemStateOf(context, item);
	const spell = item.type === 'spell';
	const weapon = isWeapon(item);
	const name = item.name;
	const tier = spellTier(item);
	const manaCost = spell && hasMana(actor, context) ? tier : 0;
	const description = plainText(rawDescriptionOf(item));
	const range = rangeWords(item, context);
	const when = whenWords(item);
	const formula = damageFormula(item);
	const concentration = spell && selectedProperties(item).includes('concentration');

	const lead = (
		spell
			? [
					options.withTier
						? tier
							? format('NIMBLE.ui.heroicActions.spellTier', { tier: String(tier) })
							: localize('NIMBLE.ui.heroicActions.cantrip')
						: '',
					when,
					range,
					...damageWords(item, context),
					concentration ? localize(`${SHARED}.concentration`) : '',
				]
			: [when, weapon ? formula : '', range]
	).filter(Boolean);

	const toggle = state.toggle;
	const gate = toggle?.on ? null : state.gate;
	const reason = gate ? gateReason(gate, context) : '';

	let use: HeroRowUse;
	if (toggle?.on) {
		use = {
			kind: 'act',
			label: format(`${SHARED}.endName`, { name }),
			intent: { kind: 'endToggle', itemId: item.id, ruleId: toggle.ruleId },
		};
	} else if (gate) {
		use = { kind: 'blocked', label: `${name}. ${reason}`, reason };
	} else {
		use = {
			kind: 'act',
			label: format(spell ? `${ACTIONS}.cast` : 'NIMBLE.actorSheet.parts.row.use', { name }),
			intent: { kind: 'activate', itemId: item.id },
		};
	}

	const summaryLead = lead.join(', ');
	const summary = reason
		? reason
		: spell
			? summaryLead || description
			: [summaryLead, description].filter(Boolean).join('. ');

	const facts: [string, string][] = [];
	const costWords = [
		state.actionCost ? actionWords(state.actionCost, context) : localize(`${SHARED}.free`),
		manaCost ? format(`${SHARED}.mana`, { cost: String(manaCost) }) : '',
	].filter(Boolean);
	facts.push([localize(`${SHARED}.facts.cost`), costWords.join(', ')]);
	if (when) facts.push([localize(`${SHARED}.facts.when`), when]);
	if (range) facts.push([localize(`${SHARED}.facts.range`), range]);
	if (formula) facts.push([localize(`${SHARED}.facts.damage`), formula]);
	facts.push(...usesFacts(state, context));

	const mana =
		context.combat || !context.manaFromInitiative ? actor.system.resources.mana.current : 0;
	return {
		id: item.id,
		name,
		img: item.img || undefined,
		tag: toggle?.on ? localize(`${SHARED}.active`) : undefined,
		tagOn: toggle?.on,
		summary: summary || undefined,
		cost: {
			...actionCost(state.actionCost, context),
			uses: usesOf(state, context),
			pool: manaCost
				? {
						kind: 'mana',
						icon: 'fa-solid fa-droplet',
						amount: manaCost,
						muted: mana < manaCost,
					}
				: undefined,
		},
		description: description || undefined,
		descriptionHtml: context.enrichedDescriptions[item.id],
		facts,
		state: toggle?.on ? 'active' : gate ? 'out' : undefined,
		use,
		choice: diceStep(item, state, context),
		edit: { kind: 'openItem', itemId: item.id },
		drag: { kind: 'item', uuid: item.uuid },
		remove: {
			label: format(`${SHARED}.deleteName`, { name }),
			question: format(`${SHARED}.deleteQuestion`, { name }),
			confirmLabel: localize(`${SHARED}.delete`),
			intent: { kind: 'deleteItem', itemId: item.id },
		},
		fields: state.pools.map((pool) => ({
			kind: 'uses' as const,
			poolId: pool.id,
			label: format(`${SHARED}.usesOf`, { name, pool: pool.label }),
			value: pool.current,
			max: pool.max,
			per: perWord(pool.per, context) ?? '',
		})),
	};
}
